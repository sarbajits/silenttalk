// Import Firebase services
import { 
    getAuth,
    signInWithPopup, 
    signOut, 
    onAuthStateChanged,
    setPersistence,
    browserLocalPersistence,
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import { 
    getDatabase,
    ref, 
    get, 
    set, 
    update, 
    push, 
    onValue, 
    onChildAdded,
    remove,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-analytics.js";

// Initialize Firebase with your config
const firebaseConfig = {
    apiKey: "AIzaSyDHmjOw-yMcQbzV2ujX5MjQiAX1_kkKKv4",
    authDomain: "silenttalk-9d497.firebaseapp.com",
    projectId: "silenttalk-9d497",
    storageBucket: "silenttalk-9d497.firebasestorage.app",
    messagingSenderId: "445636392666",
    appId: "1:445636392666:web:5b6962a8edd8ea63bbd7e3",
    measurementId: "G-RD0MEGCXTM",
    databaseURL: "https://silenttalk-9d497-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const analytics = getAnalytics(app);

// Initialize Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'select_account'
});

// DOM Elements
const authContainer = document.getElementById('auth-container');
const usernameSetup = document.getElementById('username-setup');
const chatContainer = document.getElementById('chat-container');
const googleLoginBtn = document.getElementById('google-login');
const usernameForm = document.getElementById('username-form');
const usernameInput = document.getElementById('username-input');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');
const logoutBtn = document.getElementById('logout-btn');
const usernameDisplay = document.getElementById('username-display');
const statusIndicator = document.getElementById('status-indicator');
const userSearch = document.getElementById('user-search');
const chatList = document.getElementById('chat-list');
const currentChatName = document.getElementById('current-chat-name');
const chatStatus = document.getElementById('chat-status');
const typingStatus = document.getElementById('typing-status');
const themeToggle = document.getElementById('theme-toggle');
const chatInfoModal = document.getElementById('chat-info-modal');
const closeModal = document.getElementById('close-modal');
const clearChatBtn = document.getElementById('clear-chat');
const deleteChatBtn = document.getElementById('delete-chat');
const chatInfoBtn = document.getElementById('chat-info-btn');
const deleteChatHeaderBtn = document.getElementById('delete-chat-btn');

let currentChat = null;
let userChats = {};
let typingTimeout = null;
let unreadCounts = {};

// Remove problematic code
const sidebar = document.querySelector('.sidebar');
const menuToggle = document.querySelector('.menu-toggle');
const mainChat = document.querySelector('.main-chat');

// Mobile view handlers
const chatListView = document.getElementById('chat-list-view');
const chatView = document.getElementById('chat-view');
const backToListButton = document.getElementById('back-to-list');

function showChatView() {
    if (!chatListView || !chatView) return;
    chatListView.classList.remove('active');
    chatView.classList.add('active');
}

function showChatList() {
    if (!chatListView || !chatView) return;
    chatView.classList.remove('active');
    chatListView.classList.add('active');
}

// Back button handler
if (backToListButton) {
    backToListButton.addEventListener('click', () => {
        showChatList();
    });
}

// Handle window resize
let prevWidth = window.innerWidth;
window.addEventListener('resize', () => {
    const currentWidth = window.innerWidth;
    if (!chatListView || !chatView) return;

    if (prevWidth < 768 && currentWidth >= 768) {
        // Switching to desktop view
        chatListView.classList.add('active');
        chatView.classList.add('active');
    } else if (prevWidth >= 768 && currentWidth < 768) {
        // Switching to mobile view
        chatListView.classList.add('active');
        chatView.classList.remove('active');
    }
    prevWidth = currentWidth;
});

// Initialize view based on screen size
window.addEventListener('DOMContentLoaded', () => {
    if (chatListView && chatView) {
        if (window.innerWidth >= 768) {
            chatListView.classList.add('active');
            chatView.classList.add('active');
        } else {
            chatListView.classList.add('active');
        }
    }
});

// Theme Toggle Handler
themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update icon
    themeToggle.innerHTML = `<i class="fas fa-${newTheme === 'light' ? 'moon' : 'sun'}"></i>`;
});

// Initialize theme
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = `<i class="fas fa-${savedTheme === 'light' ? 'moon' : 'sun'}"></i>`;
}

// Call initTheme on load
initTheme();

// Initialize persistence
setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
        console.error('Error setting persistence:', error);
    });

// Update handleAvatar function
function handleAvatar(imgElement, photoURL) {
    if (!imgElement) return;

    // Get username from alt text
    const username = imgElement.alt || 'User';
    
    // Set default avatar using initials
    const defaultAvatarUrl = `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(username)}&size=128`;
    
    if (!photoURL) {
        imgElement.src = defaultAvatarUrl;
            return;
        }

    // Try to load the actual photo
            imgElement.src = photoURL;
    imgElement.onerror = () => {
        imgElement.src = defaultAvatarUrl;
    };
}

// Update Google Login Handler
googleLoginBtn.addEventListener('click', async () => {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        const user = result.user;
        
        // Check if user has a username
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();

        if (!userData || !userData.username) {
            // Show username setup
            authContainer.classList.add('hidden');
            usernameSetup.classList.remove('hidden');
        } else {
            // User already has username, proceed to chat
            usernameDisplay.textContent = userData.username;
            handleAvatar(document.getElementById('user-avatar'), user.photoURL);
            authContainer.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            loadUserChats(user.uid);
        }
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            alert('Login cancelled. Please try again.');
        } else if (error.code === 'auth/popup-blocked') {
            alert('Popup blocked. Please allow popups for this site and try again.');
        } else {
            alert(error.message);
        }
    }
});

// Update Username Setup Handler
usernameForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    if (!username) return;

    try {
        const user = auth.currentUser;
        const usernameRef = ref(database, `usernames/${username}`);
        const usernameSnapshot = await get(usernameRef);

        if (usernameSnapshot.exists()) {
            alert('Username already taken');
            return;
        }

        // Save user data with photo URL
        await set(ref(database, `users/${user.uid}`), {
            username,
            email: user.email,
            status: 'online',
            lastSeen: serverTimestamp(),
            photoURL: user.photoURL || null
        });

        await set(usernameRef, user.uid);

        usernameDisplay.textContent = username;
        handleAvatar(document.getElementById('user-avatar'), user.photoURL);
        usernameSetup.classList.add('hidden');
        chatContainer.classList.remove('hidden');
        loadUserChats(user.uid);
    } catch (error) {
        alert(error.message);
    }
});

// Logout Handler
logoutBtn.addEventListener('click', async () => {
    try {
        if (auth.currentUser) {
            const userRef = ref(database, `users/${auth.currentUser.uid}/isOnline`);
            await set(userRef, false);
            await update(ref(database, `users/${auth.currentUser.uid}`), {
                status: 'offline',
                lastSeen: serverTimestamp()
            });
        }
        await signOut(auth);
        authContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
        usernameSetup.classList.add('hidden');
        currentChat = null;
        userChats = {};
        chatList.innerHTML = '';
        messagesContainer.innerHTML = '';
    } catch (error) {
        alert(error.message);
    }
});

// Add search results container
const searchResults = document.createElement('div');
searchResults.className = 'search-results hidden';
document.querySelector('.search-container').appendChild(searchResults);

// Update search functionality
userSearch.addEventListener('input', async (e) => {
    const searchTerm = e.target.value.trim().toLowerCase();
    searchResults.innerHTML = '';

    if (!searchTerm) {
        searchResults.classList.add('hidden');
        return;
    }

    try {
        searchResults.innerHTML = `
            <div class="search-loading">
                <div class="loading-dots">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        searchResults.classList.remove('hidden');

        const usersRef = ref(database, 'users');
        const snapshot = await get(usersRef);
        const users = snapshot.val();

        if (!users) {
            searchResults.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }

        const currentUser = auth.currentUser;
        const matchedUsers = Object.entries(users)
            .filter(([uid, userData]) => {
                return uid !== currentUser.uid && 
                       userData.username && 
                       userData.username.toLowerCase().includes(searchTerm);
            })
            .slice(0, 5);

        if (matchedUsers.length === 0) {
            searchResults.innerHTML = `
                <div class="search-empty">
                    <i class="fas fa-search"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }

        searchResults.innerHTML = '';
        matchedUsers.forEach(([uid, userData]) => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            
            resultItem.innerHTML = `
            <div class="avatar-container">
                    <img alt="${userData.username}" src="${userData.photoURL || `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(userData.username)}&size=128`}">
                    <span class="status-indicator ${userData.status === 'online' ? 'online' : ''}"></span>
            </div>
            <div class="search-result-info">
                    <div class="username">${userData.username}</div>
                    <div class="status">${userData.status === 'online' ? 'online' : userData.lastSeen ? `Last seen ${formatTime(userData.lastSeen)}` : 'offline'}</div>
            </div>
        `;
        
            resultItem.addEventListener('click', () => {
                startNewChat({ uid, ...userData });
                searchResults.classList.add('hidden');
                userSearch.value = '';
            });

            searchResults.appendChild(resultItem);
        });
    } catch (error) {
        console.error('Error searching users:', error);
        searchResults.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Error searching users</p>
            </div>
        `;
    }
});

// Hide search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        searchResults.classList.add('hidden');
    }
});

// Update Auth State Observer to handle persistence
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();

        if (userData) {
            // User exists, proceed to chat
            usernameDisplay.textContent = userData.username;
            handleAvatar(document.getElementById('user-avatar'), userData.photoURL);
            await update(userRef, {
                status: 'online',
                lastSeen: serverTimestamp()
            });
            
            // Show chat container
            authContainer.classList.add('hidden');
            chatContainer.classList.remove('hidden');
            loadUserChats(user.uid);
        } else {
            // New user, show username setup
            authContainer.classList.add('hidden');
            usernameSetup.classList.remove('hidden');
        }

        statusIndicator.classList.add('online');
    } else {
        // User is logged out
        authContainer.classList.remove('hidden');
        chatContainer.classList.add('hidden');
        usernameSetup.classList.add('hidden');
        statusIndicator.classList.remove('online');
        usernameDisplay.textContent = '';
        handleAvatar(document.getElementById('user-avatar'), null);
    }
});

// Update Start New Chat function
async function startNewChat(user) {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            throw new Error('You must be logged in to start a chat');
        }

        const chatId = [currentUser.uid, user.uid].sort().join('_');
        
        // Check if chat already exists
        const chatRef = ref(database, `chats/${chatId}`);
        const chatSnapshot = await get(chatRef);
        
        if (chatSnapshot.exists()) {
            // If chat exists, just load it
            loadChat(chatId, user);
            return;
        }

        // Create new chat structure with simplified participants
            const chatData = {
                participants: {
                    [currentUser.uid]: true,
                    [user.uid]: true
                },
                created: serverTimestamp(),
                lastMessage: '',
            lastMessageTime: serverTimestamp(),
            messages: {}
            };

            // Create chat first
        await set(ref(database, `chats/${chatId}`), chatData);

        // Update user references
            const updates = {};
            updates[`users/${currentUser.uid}/chats/${chatId}`] = true;
            updates[`users/${user.uid}/chats/${chatId}`] = true;
            
            await update(ref(database), updates);

        // Load chat after successful creation
        loadChat(chatId, user);
    } catch (error) {
        console.error('Error creating chat:', error);
            alert('Unable to start chat. Please try again.');
    }
}

// Update Load User's Chats function
async function loadUserChats(userId) {
    try {
        const userRef = ref(database, `users/${userId}/chats`);
        
        // Listen for changes in user's chats
        onValue(userRef, async (snapshot) => {
            const chats = snapshot.val() || {};
            
            // Get all chats data
            const chatPromises = Object.keys(chats).map(async (chatId) => {
                const chatRef = ref(database, `chats/${chatId}`);
                const chatSnapshot = await get(chatRef);
                const chatData = chatSnapshot.val();
                
                if (!chatData || !chatData.participants) return null;

                // Find the other user's ID
                const otherUserId = Object.keys(chatData.participants)
                    .find(id => id !== userId);
                
                if (!otherUserId) return null;

                const otherUserRef = ref(database, `users/${otherUserId}`);
                const otherUserSnapshot = await get(otherUserRef);
                const otherUserData = otherUserSnapshot.val();

                if (!otherUserData) return null;

                return {
                    id: chatId,
                    lastMessage: chatData.lastMessage || '',
                    lastMessageTime: chatData.lastMessageTime || null,
                    otherUser: {
                        uid: otherUserId,
                        username: otherUserData.username,
                        status: otherUserData.status || 'offline',
                        photoURL: otherUserData.photoURL,
                        lastSeen: otherUserData.lastSeen
                    }
                };
            });

            // Wait for all chat data to be fetched
            const chatResults = await Promise.all(chatPromises);
            
            // Filter out null results and sort by last message time
            const validChats = chatResults.filter(chat => chat !== null)
                .sort((a, b) => {
                    const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
                    const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
                    return timeB - timeA;
                });

            // Update userChats object and display
            userChats = Object.fromEntries(validChats.map(chat => [chat.id, chat]));
            displayChatList();

            // Set up listeners for each chat
            validChats.forEach(chat => {
                const chatRef = ref(database, `chats/${chat.id}`);
                onValue(chatRef, (snapshot) => {
                    const chatData = snapshot.val();
                    if (chatData && userChats[chat.id]) {
                        userChats[chat.id].lastMessage = chatData.lastMessage || '';
                        userChats[chat.id].lastMessageTime = chatData.lastMessageTime || null;
                        displayChatList();
                    }
                });
            });
        });
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Update displayChatList function to use handleChatItemClick
function displayChatList() {
    if (!chatList) return;
    chatList.innerHTML = '';
    
    const sortedChats = Object.values(userChats)
        .sort((a, b) => {
            const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
            const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
            return timeB - timeA;
        });

    if (sortedChats.length === 0) {
        chatList.innerHTML = `
            <div class="no-chats">
                <i class="fas fa-comments"></i>
                <p>No chats yet</p>
                <p class="subtitle">Search for users to start chatting</p>
            </div>
        `;
        return;
    }
    
    sortedChats.forEach(chat => {
        const chatElement = document.createElement('div');
        chatElement.className = `chat-item ${currentChat === chat.id ? 'active' : ''}`;
        chatElement.setAttribute('data-chat-id', chat.id);
        
        const lastMessageTime = chat.lastMessageTime ? formatTime(chat.lastMessageTime) : '';
        const statusClass = chat.otherUser.status === 'online' ? 'online' : '';
        const lastMessagePreview = chat.lastMessage || 'No messages yet';
        
        chatElement.innerHTML = `
            <div class="avatar-container">
                <img alt="${chat.otherUser.username}" src="${chat.otherUser.photoURL || `https://ui-avatars.com/api/?background=random&color=fff&name=${encodeURIComponent(chat.otherUser.username)}&size=128`}">
                <span class="status-indicator ${statusClass}"></span>
            </div>
            <div class="chat-item-info">
                <div class="chat-item-header">
                    <div class="chat-item-name">${chat.otherUser.username}</div>
                    <div class="chat-item-time">${lastMessageTime}</div>
                </div>
                <div class="chat-item-bottom">
                    <div class="chat-item-preview">${lastMessagePreview}</div>
                    ${unreadCounts[chat.id] ? `<div class="unread-count">${unreadCounts[chat.id]}</div>` : ''}
                </div>
            </div>
        `;
        
        chatElement.addEventListener('click', () => {
            handleChatItemClick(chat.id, chat.otherUser);
        });
        
        chatList.appendChild(chatElement);
    });
}

// Update loadChat function
async function loadChat(chatId, user) {
    try {
        // Update UI elements
        currentChat = chatId;
        currentChatName.textContent = user.username;
        chatStatus.textContent = user.status === 'online' ? 'online' : 'offline';
        handleAvatar(document.getElementById('chat-avatar'), user.photoURL);
        messagesContainer.innerHTML = '';

        // Load existing messages
        const messagesRef = ref(database, `chats/${chatId}/messages`);
        const snapshot = await get(messagesRef);
        const messages = snapshot.val();

        if (messages) {
            // Sort messages by timestamp and display them
            const sortedMessages = Object.entries(messages)
                .sort(([, a], [, b]) => (a.timestamp || 0) - (b.timestamp || 0));

            sortedMessages.forEach(([messageId, message]) => {
                displayMessage(message, messageId);
            });

            // Scroll to bottom after messages are loaded
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }

        // Listen for new messages
        onChildAdded(messagesRef, (snapshot) => {
            const message = snapshot.val();
            if (!document.querySelector(`[data-message-id="${snapshot.key}"]`)) {
                displayMessage(message, snapshot.key);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        });

        // Update chat list display
        displayChatList();

        // Show chat view on mobile
        if (window.innerWidth <= 768) {
            showChatView();
        }
    } catch (error) {
        console.error('Error loading chat:', error);
        alert('Error loading chat. Please try again.');
    }
}

// Update Display Message function
function displayMessage(message, messageId) {
    if (!message || !message.text) return;

    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.userId === auth.currentUser.uid ? 'sent' : 'received'}`;
    messageElement.setAttribute('data-message-id', messageId);
    
    const time = message.timestamp ? formatTime(message.timestamp) : '';
    
    messageElement.innerHTML = `
        <div class="message-content">
            <div class="message-text">${message.text}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    messagesContainer.appendChild(messageElement);
}

// Format Time
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
}

// Modal Handlers
chatInfoBtn.addEventListener('click', () => {
    chatInfoModal.classList.remove('hidden');
    chatInfoModal.classList.add('flex');
});

closeModal.addEventListener('click', () => {
    chatInfoModal.classList.add('hidden');
    chatInfoModal.classList.remove('flex');
});

clearChatBtn.addEventListener('click', async () => {
    if (!currentChat) return;
    
    if (confirm('Are you sure you want to clear all messages?')) {
        try {
            await remove(ref(database, `chats/${currentChat}/messages`));
            await update(ref(database, `chats/${currentChat}`), {
                lastMessage: '',
                lastMessageTime: serverTimestamp()
            });
            messagesContainer.innerHTML = '';
        } catch (error) {
            alert(error.message);
        }
    }
});

deleteChatBtn.addEventListener('click', async () => {
    if (!currentChat) return;
    
    if (confirm('Are you sure you want to delete this chat?')) {
        try {
            const chat = userChats[currentChat];
            await remove(ref(database, `chats/${currentChat}`));
            await remove(ref(database, `users/${auth.currentUser.uid}/chats/${currentChat}`));
            await remove(ref(database, `users/${chat.otherUser.uid}/chats/${currentChat}`));
            
            delete userChats[currentChat];
            currentChat = null;
            messagesContainer.innerHTML = '';
            displayChatList();
        } catch (error) {
            alert(error.message);
        }
    }
});

// Update window beforeunload handler
window.addEventListener('beforeunload', async () => {
    if (auth.currentUser) {
        try {
            await update(ref(database, `users/${auth.currentUser.uid}`), {
                status: 'offline',
                lastSeen: serverTimestamp()
            });
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }
});

// Add window resize handler
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        sidebar.classList.remove('active');
    }
}); 

// Message Form Handler
messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentChat) return;

    const messageText = messageInput.value.trim();
    if (!messageText) return;

    try {
        const user = auth.currentUser;
        if (!user) throw new Error('You must be logged in to send messages');

        messageInput.value = '';

        // Create message data
        const messageData = {
            text: messageText,
            userId: user.uid,
            timestamp: serverTimestamp()
        };

        // Add message and update chat metadata
        const chatRef = ref(database, `chats/${currentChat}`);
        const newMessageRef = push(ref(database, `chats/${currentChat}/messages`));
        
        const updates = {};
        updates[`/messages/${newMessageRef.key}`] = messageData;
        updates['/lastMessage'] = messageText;
        updates['/lastMessageTime'] = serverTimestamp();

        await update(chatRef, updates);

        // Update local chat data
        if (userChats[currentChat]) {
            userChats[currentChat].lastMessage = messageText;
            userChats[currentChat].lastMessageTime = Date.now();
            displayChatList();
        }

    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
});

// Typing Indicator
messageInput.addEventListener('input', async () => {
    if (!currentChat) return;

    const typingRef = ref(database, `chats/${currentChat}/typing/${auth.currentUser.uid}`);
    await set(typingRef, true);

    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }

    typingTimeout = setTimeout(async () => {
        await set(typingRef, false);
    }, 3000);
});

// Update mobile view handlers
function updateMobileView() {
    const mainChat = document.querySelector('.main-chat');
    if (window.innerWidth <= 768) {
        if (currentChat) {
            sidebar.classList.remove('active');
            mainChat.classList.add('active');
        } else {
            sidebar.classList.add('active');
            mainChat.classList.remove('active');
        }
    } else {
        sidebar.classList.remove('active');
        mainChat.classList.remove('active');
    }
}

window.addEventListener('resize', updateMobileView);