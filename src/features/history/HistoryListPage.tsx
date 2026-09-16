import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/schema';

export function HistoryListPage() {
  const navigate = useNavigate();
  const partite = useLiveQuery(() => db.matches.orderBy('data').reverse().toArray(), []);
  const squadre = useLiveQuery(() => db.teams.toArray(), []);

  function nomeSquadra(id: string) {
    return squadre?.find((s) => s.id === id)?.nome ?? id;
  }

  async function handleApri(matchId: string, stato: string) {
    if (stato === 'conclusa') {
      navigate(`/storico/${matchId}`);
      return;
    }
    const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
    const ultimoSet = sets[sets.length - 1];
    if (!ultimoSet || ultimoSet.stato === 'concluso') {
      navigate(`/partite/${matchId}/formazione`);
    } else {
      navigate(`/partite/${matchId}/scouting/${ultimoSet.id}`);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
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
