import { Link, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  user: User | null;
}

export default function Layout({ children, onLogout, user }: LayoutProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { currency, toggleCurrency } = useCurrency();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/upload', label: 'Upload' },
    { path: '/search', label: 'User Search' },
    { path: '/locations', label: 'Locations' },
    { path: '/rates', label: 'Rates' },
    ...(user?.role === 'admin' ? [{ path: '/admin', label: 'Admin' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors duration-200">
      <nav className="bg-white dark:bg-gray-800 shadow-sm transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">CallCulator</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-200 ${
                      location.pathname === item.path
                        ? 'border-indigo-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-700 dark:hover:text-gray-300'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500 dark:text-gray-400 hidden md:block">
                {user?.email}
                {user?.role === 'admin' && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 rounded">
                    Admin
                  </span>
                )}
              </span>
              <button
                onClick={toggleCurrency}
                className="px-2 py-1 rounded-md text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 border border-gray-300 dark:border-gray-600"
                aria-label="Toggle currency"
                title={`Switch to ${currency === 'USD' ? 'CHF' : 'USD'}`}
              >
                {currency}
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                aria-label="Toggle dark mode"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
              <button
                onClick={onLogout}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-sm font-medium transition-colors duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
