import { createContext, useContext, useEffect, useState } from 'react';
import { 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { ref, get, set, update, serverTimestamp } from 'firebase/database';
import { auth, database } from '../lib/firebase';
import { toast } from 'react-hot-toast';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set persistence to local
    setPersistence(auth, browserLocalPersistence);

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userRef = ref(database, `users/${user.uid}`);
        const snapshot = await get(userRef);
        const userData = snapshot.val();

        if (userData) {
          setUser({ ...user, username: userData.username });
          await update(userRef, {
            status: 'online',
            lastSeen: serverTimestamp()
          });
        } else {
          setUser(user);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Failed to sign in with Google');
      }
      throw error;
    }
  };

  // Set username
  const setUsername = async (username) => {
    if (!auth.currentUser) return;

    try {
      const usernameRef = ref(database, `usernames/${username}`);
      const snapshot = await get(usernameRef);

      if (snapshot.exists()) {
        throw new Error('Username already taken');
      }

      await set(ref(database, `users/${auth.currentUser.uid}`), {
        username,
        email: auth.currentUser.email,
        status: 'online',
        lastSeen: serverTimestamp(),
        photoURL: auth.currentUser.photoURL || null
      });

      await set(usernameRef, auth.currentUser.uid);
      setUser(prev => ({ ...prev, username }));
    } catch (error) {
      toast.error(error.message);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      if (auth.currentUser) {
        await update(ref(database, `users/${auth.currentUser.uid}`), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      }
      await signOut(auth);
      toast.success('Signed out successfully');
    } catch (error) {
      toast.error('Failed to sign out');
      throw error;
    }
  };

  // Clean up user status on window close
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (auth.currentUser) {
        await update(ref(database, `users/${auth.currentUser.uid}`), {
          status: 'offline',
          lastSeen: serverTimestamp()
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const value = {
    user,
    loading,
    signInWithGoogle,
    setUsername,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}