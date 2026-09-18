import { createBrowserRouter, Link, useNavigate, type RouteObject } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { SetPasswordForm } from '@/features/auth/AuthGate';
import { TeamListPage } from '@/features/teams/TeamListPage';
import { PlayerRosterEditor } from '@/features/teams/PlayerRosterEditor';
import { MatchSetupPage } from '@/features/match-setup/MatchSetupPage';
import { LineupPicker } from '@/features/match-setup/LineupPicker';
import { LiveScoutingScreen } from '@/features/live-scouting/LiveScoutingScreen';
import { HistoryListPage } from '@/features/history/HistoryListPage';
import { MatchReportPage } from '@/features/history/MatchReportPage';
import { SeedTestDataPage } from '@/features/dev/SeedTestDataPage';

function AccountPasswordPage() {
  const navigate = useNavigate();
  return <SetPasswordForm onImpostata={() => navigate('/')} />;
}

function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-white">
      <h1 className="text-3xl font-bold">Scouting Pallavolo</h1>
      <div className="flex w-full max-w-md flex-col gap-4">
        <Link
          to="/squadre"
          className="rounded-lg bg-slate-800 px-6 py-5 text-center text-xl font-semibold hover:bg-slate-700"
        >
          Squadre
        </Link>
        <Link
          to="/partite/nuova"
          className="rounded-lg bg-slate-800 px-6 py-5 text-center text-xl font-semibold hover:bg-slate-700"
        >
          Nuova partita
        </Link>
        <Link
          to="/storico"
          className="rounded-lg bg-slate-800 px-6 py-5 text-center text-xl font-semibold hover:bg-slate-700"
        >
          Storico
        </Link>
        <Link
          to="/account/password"
          className="rounded-lg bg-slate-900 px-6 py-3 text-center text-sm text-slate-400 hover:text-white"
        >
          Cambia password
        </Link>
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="rounded-lg bg-slate-900 px-6 py-3 text-center text-sm text-slate-400 hover:text-white"
        >
          Esci
        </button>
      </div>
    </main>
  );
}

// Array di route condiviso: usato da createBrowserRouter in produzione e da
// createMemoryRouter nei test di integrazione (createBrowserRouter richiede
// un vero contesto browser e non funziona in modo affidabile in jsdom).
export const routes: RouteObject[] = [
  { path: '/', element: <HomePage /> },
  { path: '/squadre', element: <TeamListPage /> },
  { path: '/squadre/:teamId', element: <PlayerRosterEditor /> },
  { path: '/partite/nuova', element: <MatchSetupPage /> },
  { path: '/partite/:matchId/formazione', element: <LineupPicker /> },
  { path: '/partite/:matchId/scouting/:setId', element: <LiveScoutingScreen /> },
  { path: '/storico', element: <HistoryListPage /> },
  { path: '/storico/:matchId', element: <MatchReportPage /> },
  { path: '/dev/seed', element: <SeedTestDataPage /> },
  { path: '/account/password', element: <AccountPasswordPage /> },
];

export const router = createBrowserRouter(routes);
