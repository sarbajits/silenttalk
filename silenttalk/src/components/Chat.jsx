import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, off, get } from 'firebase/database';
import { db } from '../firebase';
import PropTypes from 'prop-types';
import { getAuth } from 'firebase/auth';

const Chat = ({ chatId }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const auth = getAuth();

  const fetchChatData = useCallback(() => {
    console.log('Starting fetchChatData with chatId:', chatId);
    
    if (!chatId || !auth.currentUser) {
      console.log('Missing requirements:', { chatId, user: auth.currentUser?.uid });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, try to get the chat data once to verify access
      const chatRef = ref(db, `chats/${chatId}`);
      
      get(chatRef).then((snapshot) => {
        if (!snapshot.exists()) {
          console.error('Chat does not exist:', chatId);
          setError('Chat not found');
          setLoading(false);
          return;
        }

        const chatData = snapshot.val();
        console.log('Retrieved chat data:', chatData);

        if (!chatData.participants?.[auth.currentUser.uid]) {
          console.error('User not authorized:', auth.currentUser.uid);
          setError('Access denied');
          setLoading(false);
          return;
        }

        // If access is verified, set up real-time listeners
        onValue(chatRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
            console.log('Real-time update received:', data);
            setSelectedChat({
              id: chatId,
              ...data
            });

            // Convert messages object to array and sort by timestamp
            if (data.messages) {
              const messageArray = Object.entries(data.messages)
                .map(([id, msg]) => ({ id, ...msg }))
                .sort((a, b) => a.timestamp - b.timestamp);
              setMessages(messageArray);
            }
          }
          setLoading(false);
        });
      }).catch((error) => {
        console.error('Error fetching chat:', error);
        setError(error.message);
        setLoading(false);
      });

      return () => off(chatRef);
    } catch (error) {
      console.error('Error in fetchChatData:', error);
      setError(error.message);
      setLoading(false);
    }
  }, [chatId, auth.currentUser]);

  useEffect(() => {
    const cleanup = fetchChatData();
    return () => {
      if (cleanup) cleanup();
      console.log('Cleaning up chat listeners');
    };
  }, [fetchChatData]);

  return (
    <div className="chat-container">
      {loading && <div className="chat-loading">Loading chat...</div>}
      {error && <div className="chat-error">{error}</div>}
      {selectedChat && (
        <div className="chat-content">
          <div className="chat-header">
            <h2>Chat with {selectedChat.participants && Object.keys(selectedChat.participants)
              .filter(uid => uid !== auth.currentUser?.uid)
              .join(', ')}</h2>
          </div>
          <div className="messages-container">
            {messages.map((message) => (
              <div key={message.id} 
                   className={`message ${message.userId === auth.currentUser?.uid ? 'sent' : 'received'}`}>
                <p>{message.text}</p>
                <span className="timestamp">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

Chat.propTypes = {
  chatId: PropTypes.string
};

export default Chat;
