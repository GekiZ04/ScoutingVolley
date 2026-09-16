import { createBrowserRouter } from 'react-router-dom';
import { TeamListPage } from '@/features/teams/TeamListPage';
import { PlayerRosterEditor } from '@/features/teams/PlayerRosterEditor';
import { MatchSetupPage } from '@/features/match-setup/MatchSetupPage';
import { LineupPicker } from '@/features/match-setup/LineupPicker';
import { LiveScoutingScreen } from '@/features/live-scouting/LiveScoutingScreen';
import { HistoryListPage } from '@/features/history/HistoryListPage';

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
  { path: '/partite/nuova', element: <MatchSetupPage /> },
  { path: '/partite/:matchId/formazione', element: <LineupPicker /> },
  { path: '/partite/:matchId/scouting/:setId', element: <LiveScoutingScreen /> },
  { path: '/storico', element: <HistoryListPage /> },
]);
