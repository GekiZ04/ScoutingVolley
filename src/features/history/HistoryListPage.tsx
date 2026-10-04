import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { eliminaPartita } from '@/db/matches';
import type { Match, SetPallavolo, Team } from '@/domain/types';
import { BarraNavigazione } from '@/components/BarraNavigazione';

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

  async function handleElimina(match: Match) {
    const titolo = `${match.data} — ${nomeSquadra(match.squadraAId)} vs ${nomeSquadra(match.squadraBId)}`;
    if (!window.confirm(`Eliminare definitivamente la partita ${titolo}? Set, azioni e statistiche andranno persi.`)) return;
    try {
      await eliminaPartita(match.id);
    } catch (e) {
      window.alert(`Eliminazione non riuscita: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <BarraNavigazione />
      <h1 className="mb-6 text-2xl font-bold">Storico partite</h1>
      <ul className="space-y-2">
        {(partite ?? []).map((match) => (
          <li key={match.id} className="flex gap-2">
            <button
              type="button"
              onClick={() => handleApri(match.id, match.stato)}
              className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-left text-lg hover:bg-slate-700"
            >
              {match.data} — {nomeSquadra(match.squadraAId)} vs {nomeSquadra(match.squadraBId)} ({match.stato})
              {match.note && <span className="ml-2 text-amber-400">· {match.note}</span>}
            </button>
            <button
              type="button"
              onClick={() => handleElimina(match)}
              aria-label={`Elimina partita ${match.data} ${nomeSquadra(match.squadraAId)} vs ${nomeSquadra(match.squadraBId)}`}
              className="rounded-lg bg-red-900 px-4 py-3 text-sm font-semibold hover:bg-red-800"
            >
              Elimina
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
