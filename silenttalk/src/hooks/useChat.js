import { useState, useEffect, useRef } from 'react';
import { ref, get, onValue, update, set, push, serverTimestamp, remove, increment, onChildAdded } from 'firebase/database';
import { database } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export function useChat() {
  const [chats, setChats] = useState({});
  const [currentChat, setCurrentChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({});
  const { user } = useAuth();
  const activeListenersRef = useRef({}); // Track active listeners

  // DEBUG HELPER - Log the current state
  useEffect(() => {
    console.log("HOOK STATE:", {
      currentChat,
      chatsCount: Object.keys(chats).length,
      unreadCounts,
      activeListeners: Object.keys(activeListenersRef.current).length,
      loading
    });
  }, [chats, currentChat, loading, unreadCounts]);

  // Cleanup function for listeners
  const cleanupChatListeners = () => {
    // Unsubscribe from all active chat listeners
    Object.entries(activeListenersRef.current).forEach(([, unsubscribe]) => {
      if (Array.isArray(unsubscribe)) {
        unsubscribe.forEach(unsub => unsub());
      } else {
        unsubscribe();
      }
    });
    activeListenersRef.current = {};
  };

  // Set up listeners for individual chats
  const setupChatListeners = (chatIds) => {
    // Clean up any existing listeners first
    cleanupChatListeners();

    // No chats to listen to
    if (!chatIds.length) return;

    console.log(`Setting up listeners for ${chatIds.length} chats`);

    // Set up a listener for each chat
    chatIds.forEach(chatId => {
      if (activeListenersRef.current[chatId]) {
        // Listener already exists
        return;
      }

      const chatRef = ref(database, `chats/${chatId}`);
      const unsubscribe = onValue(chatRef, (snapshot) => {
        try {
          if (!snapshot.exists()) {
            console.log(`Chat ${chatId} no longer exists, removing from state`);
            // Remove chat from state
            setChats(prevChats => {
              const newChats = { ...prevChats };
              delete newChats[chatId];
              return newChats;
            });
            return;
          }

          const chatData = snapshot.val();
          
          // Get the existing chat from state
          setChats(prevChats => {
            const existingChat = prevChats[chatId];
            if (!existingChat) {
              console.log(`Chat ${chatId} is not in local state yet, fetching user data`);
              // This is a new chat, we need to get the other user's data
              // We'll handle this in a separate async function to avoid blocking
              fetchAndAddNewChat(chatId, chatData);
              return prevChats;
            }

            // Update unread counts
            const unreadCount = chatData.unreadBy && chatData.unreadBy[user.uid] ? chatData.unreadBy[user.uid] : 0;
            setUnreadCounts(prev => ({
              ...prev,
              [chatId]: unreadCount
            }));

            // Update chat in state
            const updatedChat = {
              ...existingChat,
              lastMessage: chatData.lastMessage || existingChat.lastMessage,
              lastMessageTime: chatData.lastMessageTime || existingChat.lastMessageTime,
              unreadCount
            };

            console.log(`Updating chat ${chatId} in real-time:`, updatedChat);
            return {
              ...prevChats,
              [chatId]: updatedChat
            };
          });
        } catch (error) {
          console.error(`Error in chat listener for ${chatId}:`, error);
        }
      });

      // Store the unsubscribe function
      activeListenersRef.current[chatId] = unsubscribe;
      
      // Also set up a specific listener for messages to update the chat list immediately
      const messagesRef = ref(database, `chats/${chatId}/messages`);
      const messagesUnsubscribe = onChildAdded(messagesRef, async (snapshot) => {
        try {
          const messageData = snapshot.val();
          if (!messageData) return;
          
          // Get the current chat data
          setChats(prevChats => {
            const existingChat = prevChats[chatId];
            if (!existingChat) return prevChats;
            
            // Only update if this is a new message (based on timestamp)
            const messageTime = messageData.timestamp;
            const lastMessageTime = existingChat.lastMessageTime;
            
            if (!lastMessageTime || (messageTime && messageTime > lastMessageTime)) {
              // This is a newer message, update the chat preview
              const updatedChat = {
                ...existingChat,
                lastMessage: messageData.text,
                lastMessageTime: messageTime
              };
              
              // If the message is from the other user and this is not the current chat, increment unread count
              if (messageData.userId !== user.uid && currentChat !== chatId) {
                // Update unread counts
                setUnreadCounts(prev => ({
                  ...prev,
                  [chatId]: (prev[chatId] || 0) + 1
                }));
                
                // Also update the unread count in the chat object
                updatedChat.unreadCount = (existingChat.unreadCount || 0) + 1;
              }
              
              return {
                ...prevChats,
                [chatId]: updatedChat
              };
            }
            
            return prevChats;
          });
        } catch (error) {
          console.error(`Error in messages listener for ${chatId}:`, error);
        }
      });
      
      // Store this unsubscribe function too
      const currentUnsubscribes = activeListenersRef.current[chatId];
      if (typeof currentUnsubscribes === 'function') {
        activeListenersRef.current[chatId] = [currentUnsubscribes, messagesUnsubscribe];
      } else {
        activeListenersRef.current[chatId].push(messagesUnsubscribe);
      }
    });
  };
  
  // Helper function to fetch user data and add a new chat to state
  const fetchAndAddNewChat = async (chatId, chatData) => {
    try {
      if (!user || !chatData.participants) return;
      
      // Get the other user's ID
      const otherUserId = Object.keys(chatData.participants)
        .find(uid => uid !== user.uid);
      
      if (!otherUserId) {
        console.error(`No other participant found in chat ${chatId}`);
        return;
      }
      
      // Get other user's data
      const otherUserRef = ref(database, `users/${otherUserId}`);
      const otherUserSnapshot = await get(otherUserRef);
      
      if (!otherUserSnapshot.exists()) {
        console.log(`Other user ${otherUserId} not found`);
        return;
      }
      
      const otherUserData = otherUserSnapshot.val();
      
      // Check if there are unread messages for this user
      const unreadCount = chatData.unreadBy && chatData.unreadBy[user.uid] ? chatData.unreadBy[user.uid] : 0;
      
      // Update unread counts
      setUnreadCounts(prev => ({
        ...prev,
        [chatId]: unreadCount
      }));
      
      // Construct chat object
      const newChat = {
        id: chatId,
        ...chatData,
        otherUser: {
          uid: otherUserId,
          username: otherUserData.username || 'Unknown User',
          photoURL: otherUserData.photoURL || null,
          status: otherUserData.status || 'offline',
          lastSeen: otherUserData.lastSeen || null
        },
        unreadCount
      };
      
      // Add to chats state
      setChats(prevChats => ({
        ...prevChats,
        [chatId]: newChat
      }));
      
    } catch (error) {
      console.error(`Error fetching data for new chat ${chatId}:`, error);
    }
  };

  // Mark messages as read when a chat is selected
  useEffect(() => {
    if (!currentChat || !user) return;
    
    const markAsRead = async () => {
      try {
        // Update the chat's unreadBy field to remove current user
        const chatRef = ref(database, `chats/${currentChat}`);
        const chatSnapshot = await get(chatRef);
        
        if (chatSnapshot.exists()) {
          const chatData = chatSnapshot.val();
          if (chatData.unreadBy && chatData.unreadBy[user.uid]) {
            // Remove current user from unreadBy
            await update(ref(database), {
              [`chats/${currentChat}/unreadBy/${user.uid}`]: null
            });
            
            // Update local unread count
            setUnreadCounts(prev => ({
              ...prev,
              [currentChat]: 0
            }));
          }
        }
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };
    
    markAsRead();
  }, [currentChat, user]);

  // Special effect to ensure chat data is available when needed
  useEffect(() => {
    const ensureChatData = async () => {
      if (!currentChat || !user) return;
      
      // If chat data already exists in state, we're good
      if (chats[currentChat]) {
        console.log("Chat data already available in state:", currentChat);
        return;
      }
      
      console.log("Ensuring chat data is available for:", currentChat);
      
      try {
        // Fetch the chat directly from Firebase
        const chatRef = ref(database, `chats/${currentChat}`);
        const chatSnapshot = await get(chatRef);
        
        if (!chatSnapshot.exists()) {
          console.error("Chat doesn't exist in Firebase:", currentChat);
          return;
        }
        
        const chatData = chatSnapshot.val();
        
        // Get the other user's ID
        const otherUserId = Object.keys(chatData.participants)
          .find(uid => uid !== user.uid);
        
        if (!otherUserId) {
          console.error("No other participant found in chat:", currentChat);
          return;
        }
        
        // Get other user's data
        const otherUserRef = ref(database, `users/${otherUserId}`);
        const otherUserSnapshot = await get(otherUserRef);
        
        let otherUserData = { username: "Unknown User" };
        if (otherUserSnapshot.exists()) {
          otherUserData = otherUserSnapshot.val();
        }
        
        // Create the chat object
        const newChat = {
          id: currentChat,
          ...chatData,
          otherUser: {
            uid: otherUserId,
            username: otherUserData.username || "Unknown User",
            photoURL: otherUserData.photoURL || null,
            status: otherUserData.status || "offline",
            lastSeen: otherUserData.lastSeen || null
          },
          // Add a method for local updates
          onLocalUpdate: (updates) => {
            setChats(prevChats => {
              const chat = prevChats[currentChat];
              if (!chat) return prevChats;
              
              return {
                ...prevChats,
                [currentChat]: {
                  ...chat,
                  ...updates
                }
              };
            });
          }
        };
        
        // Update the chats state with the new chat
        console.log("Manually adding chat to state:", newChat);
        setChats(prevChats => ({
          ...prevChats,
          [currentChat]: newChat
        }));
      } catch (error) {
        console.error("Error ensuring chat data:", error);
      }
    };
    
    ensureChatData();
  }, [currentChat, user, chats]);

  // Load chats
  useEffect(() => {
    if (!user) {
      setChats({});
      setCurrentChat(null);
      setUnreadCounts({});
      setLoading(false);
      // Clean up any active listeners
      cleanupChatListeners();
      return;
    }

    console.log('Loading chats for user:', user.uid);
    setLoading(true);
    const userChatsRef = ref(database, `users/${user.uid}/chats`);

    const unsubscribe = onValue(userChatsRef, async (snapshot) => {
      try {
        const userChats = snapshot.val() || {};
        console.log('User chats from Firebase:', userChats);
        
        if (Object.keys(userChats).length === 0) {
          console.log('No chats found for user, setting empty chats');
          setChats({});
          setLoading(false);
          cleanupChatListeners(); // Clean up any active listeners
          return;
        }
        
        // Keep track of chats we've processed
        const processedChatIds = new Set();
        
        const chatPromises = Object.keys(userChats).map(async (chatId) => {
          try {
            processedChatIds.add(chatId);
            
            const chatRef = ref(database, `chats/${chatId}`);
            const chatSnapshot = await get(chatRef);
            
            if (!chatSnapshot.exists()) {
              console.log(`Chat ${chatId} does not exist`);
              return null;
            }

            const chatData = chatSnapshot.val();
            
            // Verify chat data structure
            if (!chatData.participants || !chatData.participants[user.uid]) {
              console.log(`Invalid chat data structure for ${chatId}`);
              return null;
            }

            // Get other user's ID
            const otherUserId = Object.keys(chatData.participants)
              .find(uid => uid !== user.uid);

            if (!otherUserId) {
              console.log(`No other participant found in chat ${chatId}`);
              return null;
            }

            // Get other user's data
            const otherUserRef = ref(database, `users/${otherUserId}`);
            const otherUserSnapshot = await get(otherUserRef);
            
            if (!otherUserSnapshot.exists()) {
              console.log(`Other user ${otherUserId} not found`);
              return null;
            }

            const otherUserData = otherUserSnapshot.val();

            // Check if there are unread messages for this user
            const unreadCount = chatData.unreadBy && chatData.unreadBy[user.uid] ? chatData.unreadBy[user.uid] : 0;
            
            // Update unread counts
            setUnreadCounts(prev => ({
              ...prev,
              [chatId]: unreadCount
            }));

            // Construct chat object
            return {
              id: chatId,
              ...chatData,
              otherUser: {
                uid: otherUserId,
                username: otherUserData.username || 'Unknown User',
                photoURL: otherUserData.photoURL || null,
                status: otherUserData.status || 'offline',
                lastSeen: otherUserData.lastSeen || null
              },
              unreadCount
            };
          } catch (error) {
            console.error(`Error loading chat ${chatId}:`, error);
            return null;
          }
        });

        const validChats = (await Promise.all(chatPromises))
          .filter(Boolean);

        console.log('Valid chats:', validChats);
        
        // Create a new chats object
        const newChats = {};
        
        // First add all valid chats we just loaded
        validChats.forEach(chat => {
          newChats[chat.id] = chat;
        });
        
        // Then update state, preserving any chats that weren't in the user's chat list
        // but might be needed (like the current chat)
        setChats(prevChats => {
          const updatedChats = { ...newChats };
          
          // Keep current chat in state if it exists but wasn't in the loaded chats
          if (currentChat && prevChats[currentChat] && !updatedChats[currentChat]) {
            updatedChats[currentChat] = prevChats[currentChat];
            processedChatIds.add(currentChat);
          }
          
          return updatedChats;
        });
        
        // Set up real-time listeners for each chat
        setupChatListeners([...processedChatIds]);
        
        setLoading(false);
      } catch (error) {
        console.error('Error loading chats:', error);
        toast.error('Failed to load chats');
        setLoading(false);
      }
    });

    return () => {
      console.log('Cleaning up chat listener');
      unsubscribe();
      // Clean up individual chat listeners
      cleanupChatListeners();
    };
  }, [user]);  // Deliberately not including currentChat to avoid circular dependencies

  // Start new chat - DIRECT APPROACH
  const startChat = async (otherUser) => {
    if (!user) throw new Error('You must be logged in to start a chat');

    try {
      console.log('Starting chat with user:', otherUser);
      const chatId = [user.uid, otherUser.uid].sort().join('_');
      console.log('Generated chatId:', chatId);
      
      // Check if chat already exists in local state first
      if (chats[chatId]) {
        console.log('Chat already exists in local state, selecting it');
        setCurrentChat(chatId);
        return chatId;
      }
      
      // First check if chat exists in Firebase
      const chatRef = ref(database, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);

      let chatData;
      
      if (!chatSnapshot.exists()) {
        console.log('Creating new chat:', chatId);
        chatData = {
          participants: {
            [user.uid]: true,
            [otherUser.uid]: true
          },
          created: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          messages: {}
        };

        try {
          // Create chat and update user references atomically
          const updates = {
            [`chats/${chatId}`]: chatData,
            [`users/${user.uid}/chats/${chatId}`]: true,
            [`users/${otherUser.uid}/chats/${chatId}`]: true
          };

          await update(ref(database), updates);
          console.log('Chat created successfully');
        } catch (error) {
          // If we get a permission error, try a more limited approach
          if (error.message && error.message.includes('PERMISSION_DENIED')) {
            console.log('Permission denied for full update, trying limited approach');
            // Just create the chat and update current user's reference
            await set(chatRef, chatData);
            await set(ref(database, `users/${user.uid}/chats/${chatId}`), true);
          } else {
            throw error; // Re-throw if it's not a permission error
          }
        }
        
        // Get the updated data with the server timestamp
        const updatedSnapshot = await get(chatRef);
        if (updatedSnapshot.exists()) {
          chatData = updatedSnapshot.val();
        }
      } else {
        console.log('Chat already exists:', chatId);
        chatData = chatSnapshot.val();
      }

      // Construct the chat object with all necessary data
      const newChat = {
        id: chatId,
        ...chatData,
        created: chatData.created || serverTimestamp(),
        lastMessage: chatData.lastMessage || '',
        lastMessageTime: chatData.lastMessageTime || serverTimestamp(),
        messages: chatData.messages || {},
        participants: chatData.participants || {
          [user.uid]: true,
          [otherUser.uid]: true
        },
        otherUser: {
          uid: otherUser.uid,
          username: otherUser.username || 'Unknown User',
          photoURL: otherUser.photoURL || null,
          status: otherUser.status || 'offline',
          lastSeen: otherUser.lastSeen || null
        }
      };

      // Update local state with the new chat
      console.log('Updating local state with chat:', chatId);
      setChats(prevChats => ({
        ...prevChats,
        [chatId]: newChat
      }));
      
      // Set current chat after a short delay to ensure state is updated
      setTimeout(() => {
        console.log('Setting current chat to:', chatId);
        setCurrentChat(chatId);
      }, 50);
      
      return chatId;
    } catch (error) {
      console.error('Error in startChat:', error);
      toast.error('Failed to start chat: ' + error.message);
      throw error;
    }
  };

  // Function to select a chat
  const selectChat = async (chatId) => {
    try {
      if (!chatId) {
        setCurrentChat(null);
        return;
      }

      // Get chat data
      const chatRef = ref(database, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat not found');
      }
      
      const chatData = chatSnapshot.val();
      
      // Mark messages as read
      if (chatData.unreadBy && chatData.unreadBy[user.uid]) {
        // Remove current user from unreadBy
        await update(ref(database), {
          [`chats/${chatId}/unreadBy/${user.uid}`]: null
        });
        
        // Update local unread count
        setUnreadCounts(prev => ({
          ...prev,
          [chatId]: 0
        }));
      }
      
      // Set current chat immediately
      setCurrentChat(chatId);
    } catch (error) {
      console.error('Error selecting chat:', error);
      throw error; // Let the component handle the error
    }
  };

  // Send message
  const sendMessage = async (chatId, text) => {
    if (!user) throw new Error('You must be logged in to send a message');
    if (!text.trim()) throw new Error('Message cannot be empty');

    try {
      console.log('Sending message to chat:', chatId);
      const chatRef = ref(database, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        throw new Error('Chat does not exist');
      }
      
      const chatData = chatSnapshot.val();
      
      // Get the other user's ID
      const otherUserId = Object.keys(chatData.participants)
        .find(uid => uid !== user.uid);
      
      if (!otherUserId) {
        throw new Error('No other participant found');
      }
      
      // Create a timestamp that can be used locally
      const clientTimestamp = Date.now();
      
      // Add message to chat
      const messageRef = push(ref(database, `chats/${chatId}/messages`));
      const message = {
        text: text.trim(),
        timestamp: clientTimestamp,
        userId: user.uid
      };
      
      // Prepare all updates to be done atomically
      const updates = {
        [`chats/${chatId}/messages/${messageRef.key}`]: message,
        [`chats/${chatId}/lastMessage`]: text.trim(),
        [`chats/${chatId}/lastMessageTime`]: clientTimestamp,
        [`chats/${chatId}/unreadBy/${otherUserId}`]: increment(1)
      };
      
      // Apply all updates atomically
      await update(ref(database), updates);
      
      // Update local state immediately for better UX
      setChats(prevChats => {
        const existingChat = prevChats[chatId];
        if (!existingChat) return prevChats;
        
        return {
          ...prevChats,
          [chatId]: {
            ...existingChat,
            lastMessage: text.trim(),
            lastMessageTime: clientTimestamp
          }
        };
      });
      
      console.log('Message sent successfully:', messageRef.key);
      return messageRef.key;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error; // Let the component handle the error
    }
  };

  // Delete chat
  const deleteChat = async (chatId) => {
    if (!user) throw new Error('You must be logged in to delete a chat');

    try {
      const chat = chats[chatId];
      if (!chat) throw new Error('Chat not found');

      await remove(ref(database, `chats/${chatId}`));
      await update(ref(database), {
        [`users/${user.uid}/chats/${chatId}`]: null,
        [`users/${chat.otherUser.uid}/chats/${chatId}`]: null
      });

      setCurrentChat(null);
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
      throw error;
    }
  };

  // Clear chat messages
  const clearChat = async (chatId) => {
    if (!user) throw new Error('You must be logged in to clear chat');

    try {
      await set(ref(database, `chats/${chatId}/messages`), null);
      await update(ref(database, `chats/${chatId}`), {
        lastMessage: '',
        lastMessageTime: serverTimestamp()
      });
    } catch (error) {
      console.error('Error clearing chat:', error);
      toast.error('Failed to clear chat');
      throw error;
    }
  };

  return {
    chats,
    currentChat,
    setCurrentChat: selectChat,
    loading,
    startChat,
    sendMessage,
    deleteChat,
    clearChat,
    unreadCounts
  };
} 