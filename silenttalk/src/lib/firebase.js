import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import { getAnalytics } from 'firebase/analytics';

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
export const auth = getAuth(app);
export const database = getDatabase(app);
export const analytics = getAnalytics(app);

export default app; 