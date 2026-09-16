import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSet } from '@/db/matches';
import type { Player, Squadra } from '@/domain/types';

function useRosterAttivo(teamId: string | undefined) {
  return useLiveQuery(
    () => (teamId ? db.players.where('teamId').equals(teamId).and((p) => p.attivo).sortBy('numero') : []),
    [teamId],
  );
}

function SelettoreFormazione({
  giocatori,
  selezionati,
  onToggle,
}: {
  giocatori: Player[];
  selezionati: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {giocatori.map((g) => {
        const posizione = selezionati.indexOf(g.id);
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onToggle(g.id)}
              className={`w-full rounded-lg px-4 py-3 text-left text-lg ${posizione >= 0 ? 'bg-blue-700' : 'bg-slate-800'}`}
            >
              {posizione >= 0 ? `P${posizione + 1} — ` : ''}#{g.numero} {g.nome}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LineupPicker() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const match = useLiveQuery(() => db.matches.get(matchId!), [matchId]);
  const giocatoriA = useRosterAttivo(match?.squadraAId);
  const giocatoriB = useRosterAttivo(match?.squadraBId);

  const [formazioneA, setFormazioneA] = useState<string[]>([]);
  const [formazioneB, setFormazioneB] = useState<string[]>([]);
  const [primaSquadraAlServizio, setPrimaSquadraAlServizio] = useState<Squadra>('A');

  function toggle(formazione: string[], setFormazione: (v: string[]) => void, id: string) {
    if (formazione.includes(id)) setFormazione(formazione.filter((g) => g !== id));
    else if (formazione.length < 6) setFormazione([...formazione, id]);
  }

  async function handleContinua() {
    if (!match || formazioneA.length !== 6 || formazioneB.length !== 6) return;
    const set = await creaSet({
      matchId: match.id,
      numero: 1,
      formazioneInizialeA: formazioneA,
      formazioneInizialeB: formazioneB,
      primaSquadraAlServizio,
    });
    navigate(`/partite/${match.id}/scouting/${set.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Formazione titolare</h1>
      <p className="mb-4">Tocca i giocatori nellordine di rotazione P1...P6 (P1 al servizio).</p>
      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra A ({formazioneA.length}/6)</h2>
          <SelettoreFormazione
            giocatori={giocatoriA ?? []}
            selezionati={formazioneA}
            onToggle={(id) => toggle(formazioneA, setFormazioneA, id)}
          />
        </div>
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra B ({formazioneB.length}/6)</h2>
          <SelettoreFormazione
            giocatori={giocatoriB ?? []}
            selezionati={formazioneB}
            onToggle={(id) => toggle(formazioneB, setFormazioneB, id)}
          />
        </div>
      </div>
      <label className="mb-6 block text-lg">
        Al servizio per prima
        <select
          value={primaSquadraAlServizio}
          onChange={(e) => setPrimaSquadraAlServizio(e.target.value as Squadra)}
          className="mt-1 block w-48 rounded-lg bg-slate-800 px-4 py-3"
        >
          <option value="A">Squadra A</option>
          <option value="B">Squadra B</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleContinua}
        disabled={formazioneA.length !== 6 || formazioneB.length !== 6}
        className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-40"
      >
        Inizia partita
      </button>
    </main>
  );
}
