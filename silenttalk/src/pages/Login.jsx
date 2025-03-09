import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function Login() {
  const { signInWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      if (error.code !== 'auth/popup-closed-by-user') {
        toast.error('Failed to sign in with Google');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-light dark:bg-primary-dark">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-lg bg-white dark:bg-secondary-dark p-8 shadow-lg">
          <h2 className="mb-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
            Welcome to SilentTalk
          </h2>
          <button
            onClick={handleGoogleLogin}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-secondary-dark dark:text-gray-200 dark:hover:bg-hover-dark"
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="h-5 w-5"
            />
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
} 