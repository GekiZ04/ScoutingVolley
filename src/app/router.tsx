import { createBrowserRouter } from 'react-router-dom';
import { TeamListPage } from '@/features/teams/TeamListPage';
import { PlayerRosterEditor } from '@/features/teams/PlayerRosterEditor';

function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <h1 className="text-3xl font-bold">Scouting Pallavolo</h1>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/squadre', element: <TeamListPage /> },
  { path: '/squadre/:teamId', element: <PlayerRosterEditor /> },
]);
