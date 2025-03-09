import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

export default function SetUsername() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUsername: setUserUsername } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;

    try {
      setLoading(true);
      await setUserUsername(username.trim());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-light dark:bg-primary-dark">
      <div className="w-full max-w-md animate-fade-in">
        <div className="rounded-lg bg-white dark:bg-secondary-dark p-8 shadow-lg">
          <h2 className="mb-6 text-center text-2xl font-semibold text-gray-900 dark:text-white">
            Choose Your Username
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="username"
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent dark:border-gray-600 dark:bg-secondary-dark dark:text-white"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-accent px-4 py-2 text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                </div>
              ) : (
                'Set Username'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}