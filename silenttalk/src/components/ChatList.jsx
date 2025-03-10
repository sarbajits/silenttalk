import { useState } from 'react';
import { ref, get } from 'firebase/database';
import { database } from '../lib/firebase';
import { formatTime, getAvatarUrl, classNames } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../hooks/useChat';

export default function ChatList({ user, chats, currentChat, onChatSelect, loading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { startChat, unreadCounts } = useChat();
  const { logout } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // Sort chats by most recent message first
  const sortedChats = Object.entries(chats)
    .sort(([, chatA], [, chatB]) => {
      const timeB = chatB.lastMessageTime ? new Date(chatB.lastMessageTime).getTime() : 0;
      const timeA = chatA.lastMessageTime ? new Date(chatA.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });

  const handleSearch = async (e) => {
    const term = e.target.value.trim().toLowerCase();
    setSearchTerm(term);

    if (!term) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);
      const users = snapshot.val();

      if (!users) {
        setSearchResults([]);
        return;
      }

      const matches = Object.entries(users)
        .filter(([uid, userData]) => {
          return uid !== user.uid && 
                 userData.username && 
                 userData.username.toLowerCase().includes(term);
        })
        .map(([uid, userData]) => ({
          uid,
          ...userData
        }))
        .slice(0, 5);

      setSearchResults(matches);
    } catch (error) {
      console.error('Error searching users:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleUserSelect = async (selectedUser) => {
    try {
      // Clear search results and term immediately for better UX
      setSearchTerm('');
      setSearchResults([]);
      
      const chatId = await startChat({
        uid: selectedUser.uid,
        username: selectedUser.username,
        photoURL: selectedUser.photoURL,
        status: selectedUser.status || 'offline',
        lastSeen: selectedUser.lastSeen
      });
      
      // Small delay to ensure chat is created before selecting
      setTimeout(() => {
        onChatSelect(chatId);
      }, 100);
    } catch (error) {
      console.error('Error starting chat:', error);
    }
  };

  const handleThemeToggle = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.classList.toggle('dark', newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  // Render the chat list section
  const renderChatList = () => {
    if (loading) {
      return (
        <div className="flex h-32 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      );
    }

    if (sortedChats.length === 0) {
      return (
        <div className="flex h-32 flex-col items-center justify-center p-4 text-center text-text-light/50 dark:text-text-dark/50">
          <p className="mb-2 text-lg">No conversations yet</p>
          <p className="text-sm">Search for users to start chatting</p>
        </div>
      );
    }

    return sortedChats.map(([chatId, chat]) => {
      const unreadCount = unreadCounts[chatId] || 0;
      
      // Format the last message time
      let timeDisplay = '';
      if (chat.lastMessageTime) {
        timeDisplay = formatTime(chat.lastMessageTime);
      }

      return (
        <div
          key={chatId}
          onClick={() => onChatSelect(chatId)}
          className={classNames(
            'flex cursor-pointer items-center border-b border-border-light p-4 transition-colors dark:border-border-dark',
            chatId === currentChat
              ? 'bg-gray-100 dark:bg-gray-800'
              : unreadCount > 0 
                ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
          )}
        >
          <div className="relative h-12 w-12 flex-shrink-0">
            <img
              src={chat.otherUser.photoURL || getAvatarUrl(chat.otherUser.username)}
              alt={chat.otherUser.username}
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                e.target.src = getAvatarUrl(chat.otherUser.username);
              }}
            />
            <span className={classNames(
              'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800',
              chat.otherUser.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
            )}></span>
          </div>
          
          <div className="ml-3 flex-1 overflow-hidden">
            <div className="flex items-center justify-between">
              <span className={classNames(
                "font-medium",
                unreadCount > 0 ? "font-semibold text-primary dark:text-primary-light" : ""
              )}>
                {chat.otherUser.username}
              </span>
              <div className="flex items-center">
                {/* Unread count badge */}
                {unreadCount > 0 && (
                  <span className="mr-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
                {/* Time */}
                {timeDisplay && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {timeDisplay}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              {/* Last message with truncation */}
              <p className={classNames(
                "mt-1 truncate text-sm",
                unreadCount > 0 
                  ? "text-gray-800 dark:text-gray-200" 
                  : "text-gray-500 dark:text-gray-400"
              )}>
                {chat.lastMessage || 'No messages yet'}
              </p>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light p-4 dark:border-border-dark">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10">
            <img
              src={user.photoURL || getAvatarUrl(user.username)}
              alt={user.username}
              className="h-full w-full rounded-full object-cover"
              onError={(e) => {
                e.target.src = getAvatarUrl(user.username);
              }}
            />
            <span className="status-indicator online"></span>
          </div>
          <span className="font-medium">{user.username}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleThemeToggle}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5 dark:hidden">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="hidden h-5 w-5 dark:block">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
            </svg>
          </button>
          <button
            onClick={logout}
            className="rounded-full p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="border-b border-border-light p-4 dark:border-border-dark">
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearch}
            placeholder="Search users..."
            className="w-full rounded-lg border border-border-light bg-secondary-light px-4 py-2 pr-10 focus:border-accent focus:outline-none dark:border-border-dark dark:bg-secondary-dark"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isSearching ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent"></div>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchTerm && (
          <div className="absolute z-10 mt-2 w-[calc(100%-2rem)] max-h-60 overflow-y-auto rounded-lg border border-border-light bg-primary-light shadow-lg dark:border-border-dark dark:bg-primary-dark">
            {searchResults.length > 0 ? (
              searchResults.map(user => (
                <div
                  key={user.uid}
                  onClick={() => handleUserSelect(user)}
                  className="flex cursor-pointer items-center gap-3 border-b border-border-light p-4 transition-colors hover:bg-gray-50 dark:border-border-dark dark:hover:bg-gray-800"
                >
                  <div className="relative h-10 w-10">
                    <img
                      src={user.photoURL || getAvatarUrl(user.username)}
                      alt={user.username}
                      className="h-full w-full rounded-full object-cover"
                      onError={(e) => {
                        e.target.src = getAvatarUrl(user.username);
                      }}
                    />
                    <span className={classNames(
                      'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800',
                      user.status === 'online' ? 'bg-green-500' : 'bg-gray-400'
                    )}></span>
                  </div>
                  <div>
                    <div className="font-medium">{user.username}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {user.status === 'online' ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                No users found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {renderChatList()}
      </div>
    </div>
  );
} 