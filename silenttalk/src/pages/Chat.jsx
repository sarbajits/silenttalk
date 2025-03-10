import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';
import ChatList from '../components/ChatList';
import ChatView from '../components/ChatView';
import { classNames } from '../utils/helpers';

export default function Chat() {
  const [isMobileViewActive, setIsMobileViewActive] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const { user } = useAuth();
  const { chats, currentChat, setCurrentChat, loading, sendMessage, deleteChat, clearChat } = useChat();

  // Get the selected chat object
  const selectedChat = currentChat ? chats[currentChat] : null;

  // Set up mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileDevice(window.innerWidth <= 768);
    };
    
    // Check initially
    checkMobile();
    
    // Add resize listener
    window.addEventListener('resize', checkMobile);
    
    // Clean up
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debugging state
  useEffect(() => {
    console.log('Chat.jsx - State changed:', {
      currentChat,
      selectedChatExists: !!selectedChat,
      isMobileViewActive,
      isMobileDevice,
      chatsAvailable: Object.keys(chats).length,
      chatsData: Object.keys(chats)
    });
  }, [chats, currentChat, selectedChat, isMobileViewActive, isMobileDevice]);

  // Mobile view handling only on small screens
  useEffect(() => {
    if (currentChat && isMobileDevice) {
      console.log('Setting mobile view active for selected chat on small screen');
      setIsMobileViewActive(true);
    }
  }, [currentChat, isMobileDevice]);

  // Reset mobile view when no chat is selected
  useEffect(() => {
    if (!currentChat && isMobileViewActive) {
      setIsMobileViewActive(false);
    }
  }, [currentChat, isMobileViewActive]);

  const handleChatSelect = async (chatId) => {
    console.log('Chat.jsx - Handling chat selection:', chatId);
    if (!chatId) {
      console.error('No chatId provided');
      return;
    }

    try {
      // If we're already on this chat, do nothing
      if (currentChat === chatId) {
        console.log('Already on this chat, no need to change');
        return;
      }
      
      // Set the new chat directly
      await setCurrentChat(chatId);
      
      // Force a small delay to ensure Firebase data is loaded
      setTimeout(() => {
        // Only activate mobile view on small screens
        if (isMobileDevice) {
          console.log('Activating mobile view for selected chat (small screen)');
          setIsMobileViewActive(true);
        }
      }, 100); // Increased delay to ensure data is loaded
    } catch (error) {
      console.error('Error selecting chat:', error);
    }
  };

  const handleSendMessage = async (chatId, text) => {
    try {
      // Prevent unnecessary re-renders by not awaiting the result
      const result = await sendMessage(chatId, text);
      return result;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  const handleBackToList = () => {
    console.log('Handling back to list');
    setIsMobileViewActive(false);
    // Use a small timeout to ensure UI updates before changing chat
    setTimeout(() => {
      setCurrentChat(null);
    }, 50);
  };

  return (
    <div className="h-screen bg-primary-light dark:bg-primary-dark overflow-hidden">
      <div className="mx-auto h-full max-w-7xl">
        <div className="grid h-full md:grid-cols-[350px_1fr]">
          {/* Chat List - Always visible on desktop, conditionally on mobile */}
          <div
            className={classNames(
              'h-full border-r border-border-light dark:border-border-dark bg-primary-light dark:bg-primary-dark',
              // Only hide on mobile when a chat is selected
              isMobileViewActive && isMobileDevice ? 'hidden md:block' : 'block'
            )}
          >
            <ChatList
              user={user}
              chats={chats}
              currentChat={currentChat}
              onChatSelect={handleChatSelect}
              loading={loading}
            />
          </div>

          {/* Chat View - Always visible on desktop when chat selected, conditionally on mobile */}
          <div
            className={classNames(
              'h-full bg-secondary-light dark:bg-secondary-dark flex flex-col',
              // Show chat view when mobile view is active or when a chat is selected on desktop
              isMobileViewActive ? 'block' : 
              selectedChat ? 'hidden md:block' : 'hidden md:block'
            )}
          >
            <ChatView
              user={user}
              chat={selectedChat}
              onSendMessage={handleSendMessage}
              onDeleteChat={deleteChat}
              onClearChat={clearChat}
              onBack={handleBackToList}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 