import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { aggiungiGiocatore, archiviaGiocatore } from '@/db/teams';
import type { Ruolo } from '@/domain/types';

const RUOLI: Ruolo[] = ['palleggiatore', 'opposto', 'schiacciatore', 'centrale', 'libero'];

export function PlayerRosterEditor() {
  const { teamId } = useParams<{ teamId: string }>();
  const squadra = useLiveQuery(() => db.teams.get(teamId!), [teamId]);
  const giocatori = useLiveQuery(
    () => db.players.where('teamId').equals(teamId!).and((p) => p.attivo).sortBy('numero'),
    [teamId],
  );

  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState<Ruolo>('schiacciatore');

  async function handleAggiungi(event: FormEvent) {
    event.preventDefault();
    if (!nome.trim() || !numero) return;
    await aggiungiGiocatore({ teamId: teamId!, numero: Number(numero), nome: nome.trim(), ruolo });
    setNumero('');
    setNome('');
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">{squadra?.nome ?? '...'}</h1>
      <form onSubmit={handleAggiungi} className="mb-6 flex flex-wrap gap-3">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          type="number"
          placeholder="Numero"
          className="w-24 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome giocatore"
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <select
          value={ruolo}
          onChange={(e) => setRuolo(e.target.value as Ruolo)}
          className="rounded-lg bg-slate-800 px-4 py-3 text-lg"
        >
          {RUOLI.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Aggiungi
        </button>
      </form>
      <ul className="space-y-2">
        {(giocatori ?? []).map((giocatore) => (
          <li key={giocatore.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3">
            <span className="text-lg">
              #{giocatore.numero} {giocatore.nome} — {giocatore.ruolo}
            </span>
            <button
              type="button"
              onClick={() => archiviaGiocatore(giocatore.id)}
              className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold"
            >
              Archivia
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
