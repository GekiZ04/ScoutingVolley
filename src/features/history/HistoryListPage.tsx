import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import type { Match, SetPallavolo, Team } from '@/domain/types';

export function HistoryListPage() {
  const navigate = useNavigate();
  const partite = useSupabaseQuery<Match[]>(
    async () => {
      const { data, error } = await supabase.from('matches').select('*').order('data', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
    [],
    ['matches'],
  );
  const squadre = useSupabaseQuery<Team[]>(
    async () => {
      const { data, error } = await supabase.from('teams').select('*');
      if (error) throw error;
      return data as Team[];
    },
    [],
    ['teams'],
  );

  function nomeSquadra(id: string) {
    return squadre?.find((s) => s.id === id)?.nome ?? id;
  }

  async function handleApri(matchId: string, stato: string) {
    if (stato === 'conclusa') {
      navigate(`/storico/${matchId}`);
      return;
    }
    const { data: sets, error } = await supabase
      .from('sets')
      .select('*')
      .eq('matchId', matchId)
      .order('numero');
    if (error) throw error;
    const ultimoSet = (sets as SetPallavolo[])[sets.length - 1];
    if (!ultimoSet || ultimoSet.stato === 'concluso') {
      navigate(`/partite/${matchId}/formazione`);
    } else {
      navigate(`/partite/${matchId}/scouting/${ultimoSet.id}`);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <Link to="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Storico partite</h1>
      <ul className="space-y-2">
        {(partite ?? []).map((match) => (
          <li key={match.id}>
            <button
              type="button"
              onClick={() => handleApri(match.id, match.stato)}
              className="w-full rounded-lg bg-slate-800 px-4 py-3 text-left text-lg hover:bg-slate-700"
            >
              {match.data} — {nomeSquadra(match.squadraAId)} vs {nomeSquadra(match.squadraBId)} ({match.stato})
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
