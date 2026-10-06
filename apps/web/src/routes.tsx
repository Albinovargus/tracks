import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from './components/layout/AppShell.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
import { LoginPage } from './pages/LoginPage.js';
import { RoomPage } from './features/avatar-room/RoomPage.js';
import { CreatorPage } from './features/avatar-creator/CreatorPage.js';

/** The app's route table. router.tsx mounts it in the hash router; tests in memory routers. */
export const routes: RouteObject[] = [
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      // The room draws its own chrome over the art (room world spec §1).
      { index: true, element: <RoomPage /> },
      {
        element: <AppShell />,
        children: [{ path: 'create', element: <CreatorPage /> }],
      },
    ],
  },
  // Unknown paths (say, an old #/signup link) go home, where RequireAuth decides.
  { path: '*', element: <Navigate to="/" replace /> },
];
