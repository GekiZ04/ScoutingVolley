import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { creaPartita } from '@/db/matches';
import type { Team } from '@/domain/types';
import { BarraNavigazione } from '@/components/BarraNavigazione';

export function MatchSetupPage() {
  const navigate = useNavigate();
  const squadre = useSupabaseQuery<Team[]>(
    async () => {
      const { data, error } = await supabase.from('teams').select('*').order('nome');
      if (error) throw error;
      return data as Team[];
    },
    [],
    ['teams'],
  );

  const [squadraAId, setSquadraAId] = useState('');
  const [squadraBId, setSquadraBId] = useState('');
  const [squadraRiferimentoId, setSquadraRiferimentoId] = useState<string>('');
  const [formatoSet, setFormatoSet] = useState<3 | 5>(5);
  const [puntiSet, setPuntiSet] = useState(25);
  const [puntiSetDecisivo, setPuntiSetDecisivo] = useState(15);
  const [amichevole, setAmichevole] = useState(false);

  async function handleCrea(event: FormEvent) {
    event.preventDefault();
    if (!squadraAId) return;
    if (!amichevole && (!squadraBId || squadraAId === squadraBId)) return;
    const match = await creaPartita({
      data: new Date().toISOString().slice(0, 10),
      squadraAId,
      squadraBId: amichevole ? squadraAId : squadraBId,
      squadraRiferimentoId: amichevole ? squadraAId : squadraRiferimentoId || null,
      formatoSet,
      puntiSet,
      puntiSetDecisivo,
      note: amichevole ? 'Amichevole' : undefined,
    });
    navigate(`/partite/${match.id}/formazione`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <BarraNavigazione />
      <h1 className="mb-6 text-2xl font-bold">Nuova partita</h1>
      <form onSubmit={handleCrea} className="max-w-xl space-y-4">
        <label className="block">
          Squadra A
          <select
            value={squadraAId}
            onChange={(e) => setSquadraAId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          >
            <option value="">Seleziona...</option>
            {(squadre ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-lg">
          <input
            type="checkbox"
            checked={amichevole}
            onChange={(e) => setAmichevole(e.target.checked)}
            className="h-5 w-5"
          />
          Amichevole (la squadra sfida se stessa)
        </label>
        {!amichevole && (
          <label className="block">
            Squadra B
            <select
              value={squadraBId}
              onChange={(e) => setSquadraBId(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
            >
              <option value="">Seleziona...</option>
              {(squadre ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>
        )}
        {!amichevole && (
          <label className="block">
            Squadra di riferimento (facoltativa, per pre-scout tra due squadre terze lascia vuoto)
            <select
              value={squadraRiferimentoId}
              onChange={(e) => setSquadraRiferimentoId(e.target.value)}
              className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
            >
              <option value="">Nessuna</option>
              {squadraAId && <option value={squadraAId}>Squadra A</option>}
              {squadraBId && <option value={squadraBId}>Squadra B</option>}
            </select>
          </label>
        )}
        <label className="block">
          Formato set
          <select
            value={formatoSet}
            onChange={(e) => setFormatoSet(Number(e.target.value) as 3 | 5)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          >
            <option value={3}>Al meglio dei 3</option>
            <option value={5}>Al meglio dei 5</option>
          </select>
        </label>
        <label className="block">
          Punti per set
          <input
            type="number"
            value={puntiSet}
            onChange={(e) => setPuntiSet(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          />
        </label>
        <label className="block">
          Punti set decisivo
          <input
            type="number"
            value={puntiSetDecisivo}
            onChange={(e) => setPuntiSetDecisivo(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          />
        </label>
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Continua alla formazione
        </button>
      </form>
    </main>
  );
}
