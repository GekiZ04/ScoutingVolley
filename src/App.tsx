import { Analytics } from '@vercel/analytics/react';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';
import { AuthGate } from './features/auth/AuthGate';
import { UpdatePrompt } from './components/UpdatePrompt';

export default function App() {
  return (
    <AuthGate>
      <RouterProvider router={router} />
      <Analytics />
      <UpdatePrompt />
    </AuthGate>
  );
}
