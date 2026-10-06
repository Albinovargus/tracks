import { useEffect } from 'react';
import { RouterProvider } from 'react-router/dom';
import { router } from './router.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { initAuth } from './lib/auth-init.js';

export function App() {
  // Once per app load: initAuth ignores StrictMode's second run, and the auth
  // subscription lives as long as the page, so no cleanup.
  useEffect(() => {
    initAuth();
  }, []);

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  );
}
