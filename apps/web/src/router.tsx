import { createHashRouter } from 'react-router';
import { AppShell } from './components/layout/AppShell.js';
import { RequireAuth } from './components/layout/RequireAuth.js';
import { LoginPage } from './pages/LoginPage.js';
import { RoomPage } from './features/avatar-room/RoomPage.js';
import { CreatorPage } from './features/avatar-creator/CreatorPage.js';

export const router = createHashRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <RoomPage /> },
          { path: 'create', element: <CreatorPage /> },
        ],
      },
    ],
  },
]);
