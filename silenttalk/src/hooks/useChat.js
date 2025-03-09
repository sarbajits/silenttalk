import { useState, useEffect, useRef } from 'react';
import { ref, get, onValue, update, set, push, serverTimestamp, remove, increment } from 'firebase/database';
import { database } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

export function useChat() {
  const [chats, setChats] = useState({});
  const [currentChat, setCurrentChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forceRender, setForceRender] = useState(0); // Used to force re-renders
  const [unreadCounts, setUnreadCounts] = useState({}); // Store unread counts by chatId
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
    Object.values(activeListenersRef.current).forEach(unsubscribe => {
      unsubscribe();
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
          const existingChat = chats[chatId];
          if (!existingChat) {
            console.log(`Chat ${chatId} is not in local state yet`);
            return;
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
          setChats(prevChats => ({
            ...prevChats,
            [chatId]: updatedChat
          }));
        } catch (error) {
          console.error(`Error in chat listener for ${chatId}:`, error);
        }
      });

      // Store the unsubscribe function
      activeListenersRef.current[chatId] = unsubscribe;
    });
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
          }
        };
        
        // Update the chats state with the new chat
        console.log("Manually adding chat to state:", newChat);
        setChats(prevChats => ({
          ...prevChats,
          [currentChat]: newChat
        }));
        
        // Force a re-render
        setForceRender(prev => prev + 1);
      } catch (error) {
        console.error("Error ensuring chat data:", error);
      }
    };
    
    ensureChatData();
  }, [currentChat, user, forceRender]);

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
        
        const chatPromises = Object.keys(userChats).map(async (chatId) => {
          try {
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
          .filter(Boolean)
          .sort((a, b) => {
            // Sort by most recent message first
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            return timeB - timeA;
          });

        console.log('Valid chats:', validChats);
        const newChats = Object.fromEntries(validChats.map(chat => [chat.id, chat]));
        console.log('Setting chats state with:', newChats);
        
        setChats(prevChats => {
          // Keep current chat in state if it exists 
          if (currentChat && prevChats[currentChat] && !newChats[currentChat]) {
            newChats[currentChat] = prevChats[currentChat];
          }
          return newChats;
        });
        
        // Set up real-time listeners for each chat
        setupChatListeners(Object.keys(newChats));
        
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

        // Create chat and update user references atomically
        const updates = {
          [`chats/${chatId}`]: chatData,
          [`users/${user.uid}/chats/${chatId}`]: true,
          [`users/${otherUser.uid}/chats/${chatId}`]: true
        };

        await update(ref(database), updates);
        console.log('Chat created successfully');
        
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

      // CRITICAL: Update local state first, then set current chat
      console.log('CRITICAL - Updating local state with chat:', chatId);
      
      // Immediately update the chat in state
      setChats(prevChats => {
        const updatedChats = {
          ...prevChats,
          [chatId]: newChat
        };
        console.log('Updated chats with new chat. Chats now has:', Object.keys(updatedChats).length, 'chats');
        return updatedChats;
      });
      
      // Wait for state update to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Force a render update to ensure the chat data is in state
      setForceRender(prev => prev + 1);
      
      // Wait again
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Now set the current chat
      console.log('Setting current chat to:', chatId);
      setCurrentChat(chatId);
      
      return chatId;
    } catch (error) {
      console.error('Error in startChat:', error);
      toast.error('Failed to start chat: ' + error.message);
      throw error;
    }
  };

  // Function to select a chat
  const selectChat = async (chatId) => {
    console.log('Selecting chat:', chatId);
    if (!chatId) {
      console.error('No chatId provided');
      return;
    }

    try {
      // Verify chat still exists in Firebase
      const chatRef = ref(database, `chats/${chatId}`);
      const chatSnapshot = await get(chatRef);
      
      if (!chatSnapshot.exists()) {
        console.error('Chat no longer exists in Firebase');
        toast.error('Chat no longer exists');
        return;
      }

      // If the chat is not in local state, add it
      if (!chats[chatId]) {
        console.log('Chat not in local state, fetching data');
        const chatData = chatSnapshot.val();
        
        // Get other user's ID
        const otherUserId = Object.keys(chatData.participants)
          .find(uid => uid !== user.uid);
        
        if (!otherUserId) {
          console.error('No other participant found');
          return;
        }
        
        // Get other user's data
        const otherUserRef = ref(database, `users/${otherUserId}`);
        const otherUserSnapshot = await get(otherUserRef);
        
        let otherUserData = { username: 'Unknown User' };
        if (otherUserSnapshot.exists()) {
          otherUserData = otherUserSnapshot.val();
        }
        
        // Add chat to local state
        const newChat = {
          id: chatId,
          ...chatData,
          otherUser: {
            uid: otherUserId,
            username: otherUserData.username || 'Unknown User',
            photoURL: otherUserData.photoURL || null,
            status: otherUserData.status || 'offline',
            lastSeen: otherUserData.lastSeen || null
          }
        };
        
        setChats(prevChats => ({
          ...prevChats,
          [chatId]: newChat
        }));
        
        // Force a re-render
        setForceRender(prev => prev + 1);
        
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      console.log('Setting current chat to:', chatId);
      setCurrentChat(chatId);
    } catch (error) {
      console.error('Error selecting chat:', error);
      toast.error('Failed to select chat');
    }
  };

  // Send message
  const sendMessage = async (chatId, text) => {
    if (!user) throw new Error('You must be logged in to send a message');
    if (!text.trim()) throw new Error('Message cannot be empty');

    try {
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
      
      // Add message to chat
      const messageRef = push(ref(database, `chats/${chatId}/messages`));
      const message = {
        text: text.trim(),
        timestamp: serverTimestamp(),
        userId: user.uid
      };

      await set(messageRef, message);
      
      // Update the chat with the new message info
      const updates = {
        [`chats/${chatId}/lastMessage`]: text.trim(),
        [`chats/${chatId}/lastMessageTime`]: serverTimestamp()
      };
      
      // Increment unread count for the other user
      if (otherUserId) {
        updates[`chats/${chatId}/unreadBy/${otherUserId}`] = increment(1);
      }
      
      await update(ref(database), updates);
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
      throw error;
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