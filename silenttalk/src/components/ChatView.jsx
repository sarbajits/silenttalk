import { useState, useEffect, useRef } from 'react';
import { ref, onChildAdded, get } from 'firebase/database';
import { database } from '../lib/firebase';
import { formatTime, getAvatarUrl } from '../utils/helpers';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { toast } from 'react-hot-toast';

export default function ChatView({ user, chat, onSendMessage, onDeleteChat, onClearChat, onBack }) {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const chatId = chat?.id;
  const messagesLoadedRef = useRef(false);

  // Log when chat prop changes
  useEffect(() => {
    console.log('ChatView: chat prop changed:', chat ? `Chat ID: ${chat.id}` : 'No chat selected');
    
    if (chat) {
      // Only reset messages if the chat ID has changed
      if (chat.id !== chatId) {
        console.log('Chat ID changed, resetting state for:', chat.id);
        setMessages([]);
        setLoading(true);
        setMessage(''); // Clear input field when changing chats
        setSendingMessage(false); // Reset sending state
        messagesLoadedRef.current = false; // Reset the messages loaded flag
      } else {
        console.log('Same chat ID, maintaining state for:', chat.id);
      }
    } else {
      console.log('No chat selected, resetting state');
      setMessages([]);
      setLoading(false);
      setMessage('');
      setSendingMessage(false);
      messagesLoadedRef.current = false;
    }
  }, [chat, chatId]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  };

  // Auto-scroll on message updates
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages]);

  // Load initial messages and set up real-time listener
  useEffect(() => {
    let isActive = true; // Flag to handle component unmount
    let unsubscribe = null;
    
    if (!chatId) {
      console.log('No chatId, skipping message loading');
      setMessages([]);
      return;
    }

    console.log('Loading messages for chat:', chatId);
    const messagesRef = ref(database, `chats/${chatId}/messages`);

    // Load existing messages
    get(messagesRef).then((snapshot) => {
      if (!isActive) return; // Don't update state if component is unmounted
      
      const messagesData = snapshot.val();
      if (messagesData) {
        // Convert messages object to array and sort by timestamp
        const messagesList = Object.entries(messagesData)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        console.log('Loaded messages:', messagesList.length);
        setMessages(messagesList);
        // Scroll to bottom after loading messages
        setTimeout(scrollToBottom, 100);
      } else {
        console.log('No messages found for chat:', chatId);
        setMessages([]);
      }
      
      messagesLoadedRef.current = true;
      setLoading(false); // Set loading to false after messages are loaded
    }).catch((error) => {
      if (!isActive) return; // Don't update state if component is unmounted
      
      console.error('Error loading messages:', error);
      setMessages([]); // Reset messages on error to avoid stale state
      setLoading(false); // Set loading to false on error
    });

    // Listen for new messages
    unsubscribe = onChildAdded(messagesRef, async (snapshot) => {
      if (!isActive) return; // Don't update state if component is unmounted
      
      const messageData = snapshot.val();
      if (messageData) {
        console.log('New message received:', messageData);
        
        // Use functional update to avoid closure issues
        setMessages(prev => {
          // Check if message already exists (by id or by matching content for temp messages)
          const messageExists = prev.some(m => 
            m.id === snapshot.key || 
            (m.id.startsWith('temp-') && m.text === messageData.text && m.userId === messageData.userId)
          );
          
          if (messageExists) {
            // If it's a temp message, replace it with the real one
            if (prev.some(m => m.id.startsWith('temp-') && m.text === messageData.text && m.userId === messageData.userId)) {
              const updatedMessages = prev.map(m => 
                (m.id.startsWith('temp-') && m.text === messageData.text && m.userId === messageData.userId)
                  ? { id: snapshot.key, ...messageData }
                  : m
              );
              
              // Scroll to bottom after updating messages
              setTimeout(scrollToBottom, 100);
              
              return updatedMessages;
            }
            return prev;
          }
          
          const newMessage = { id: snapshot.key, ...messageData };
          const updatedMessages = [...prev, newMessage].sort((a, b) => 
            (a.timestamp || 0) - (b.timestamp || 0)
          );
          
          // Scroll to bottom after adding new message
          setTimeout(scrollToBottom, 100);
          
          return updatedMessages;
        });
      }
    });

    // Cleanup function
    return () => {
      isActive = false; // Mark component as unmounted
      console.log('Cleaning up message listeners for chat:', chatId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [chatId]);

  // Handle message submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() || !chatId || sendingMessage) return;

    const sentMessage = message.trim();
    
    // Clear input field immediately
    setMessage('');
    
    // Set sending state
    setSendingMessage(true);
    
    // Add message to local state immediately for better UX
    const tempId = `temp-${Date.now()}`;
    const tempTimestamp = Date.now();
    const tempMessage = {
      id: tempId,
      text: sentMessage,
      timestamp: tempTimestamp,
      userId: user.uid,
      pending: true // Add pending flag
    };
    
    // Add to local messages state
    setMessages(prev => {
      const updatedMessages = [...prev, tempMessage].sort((a, b) => 
        (a.timestamp || 0) - (b.timestamp || 0)
      );
      
      // Scroll to bottom immediately after adding temp message
      setTimeout(scrollToBottom, 10);
      
      return updatedMessages;
    });
    
    try {
      // Send to server
      await onSendMessage(chatId, sentMessage);
      
      // Update the temporary message to remove pending state
      setMessages(prev => {
        const updatedMessages = prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, pending: false }
            : msg
        );
        
        // Scroll to bottom after updating message state
        setTimeout(scrollToBottom, 10);
        
        return updatedMessages;
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      
      // Remove the temporary message if sending failed
      setMessages(prev => {
        const filteredMessages = prev.filter(msg => msg.id !== tempId);
        
        // Scroll to bottom after removing failed message
        setTimeout(scrollToBottom, 10);
        
        return filteredMessages;
      });
    } finally {
      setSendingMessage(false);
    }
  };

  // Auto-scroll on message updates
  useEffect(() => {
    if (messages.length > 0) {
      // Use a longer timeout to ensure DOM is updated
      const timeoutId = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages]);

  // Adding a back button in the header for mobile view
  const renderHeader = () => {
    return (
      <div className="border-b border-border-light dark:border-border-dark p-4 flex items-center justify-between">
        <div className="flex items-center">
          {/* Mobile back button */}
          <button 
            className="md:hidden mr-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={onBack}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          
          {chat && (
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full overflow-hidden mr-3">
                <img 
                  src={getAvatarUrl(chat.otherUser.photoURL)} 
                  alt={chat.otherUser.username} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="font-semibold text-text-light dark:text-text-dark">
                  {chat.otherUser.username}
                </div>
                <div className="text-xs text-text-light/70 dark:text-text-dark/70">
                  {chat.otherUser.status === 'online' ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {chat && (
          <div className="flex items-center">
            <button
              className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-text-light/70 dark:text-text-dark/70"
              onClick={() => setIsModalOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  // If no chat is selected, show a placeholder
  if (!chat) {
    console.log('No chat selected, showing placeholder');
    return (
      <div className="flex h-full flex-col items-center justify-center p-4 text-center">
        <h3 className="mb-2 text-xl font-semibold text-text-light dark:text-text-dark">
          Select a conversation or start a new chat
        </h3>
        <p className="text-text-light/70 dark:text-text-dark/70">
          Choose an existing conversation from the list or search for a user to start a new chat.
        </p>
      </div>
    );
  }

  // Debug output
  console.log('ChatView render state:', { 
    loading, 
    messagesCount: messages.length, 
    chatId,
    chatExists: !!chat,
    chatData: chat
  });

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      {renderHeader()}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent" id="messages-container" style={{ maxHeight: 'calc(100vh - 140px)' }}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-text-light/50 dark:text-text-dark/50">
            <p className="mb-2 text-lg">No messages yet</p>
            <p className="text-sm">Start the conversation by sending a message</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.userId === user.uid ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] md:max-w-[70%] lg:max-w-[60%] rounded-lg p-3 ${
                    msg.userId === user.uid
                      ? `bg-primary text-white ${msg.pending ? 'opacity-70' : ''}`
                      : 'bg-secondary-light dark:bg-secondary-dark text-text-light dark:text-text-dark'
                  }`}
                >
                  <div className="relative break-words">
                    {msg.text}
                    {msg.pending && (
                      <span className="absolute -right-6 top-1/2 -translate-y-1/2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-right text-xs opacity-70">
                    {formatTime(msg.timestamp)}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Message Input */}
      <div className="border-t border-border-light dark:border-border-dark p-4">
        <form onSubmit={handleSubmit} className="flex">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 rounded-l-lg border border-border-light bg-white p-2 focus:outline-none dark:border-border-dark dark:bg-primary-dark dark:text-text-dark"
            disabled={sendingMessage}
          />
          <button
            type="submit"
            disabled={!message.trim() || sendingMessage}
            className="rounded-r-lg bg-primary px-4 text-white disabled:opacity-50"
          >
            {sendingMessage ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>

      {/* Chat Actions Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setIsModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all dark:bg-primary-dark">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-text-light dark:text-text-dark"
                  >
                    Chat Actions
                  </Dialog.Title>

                  <div className="mt-4 space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center rounded-lg p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => {
                        setIsModalOpen(false);
                        onClearChat(chatId);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                      Clear chat history
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center rounded-lg p-3 text-left text-red-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => {
                        setIsModalOpen(false);
                        onDeleteChat(chatId);
                      }}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 h-5 w-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                      </svg>
                      Delete chat
                    </button>
                  </div>

                  <div className="mt-6">
                    <button
                      type="button"
                      className="w-full rounded-lg bg-primary px-4 py-2 text-white"
                      onClick={() => setIsModalOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
} 