import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { caricaSetVinti } from '@/db/risultatiPartite';
import type { Match, Team } from '@/domain/types';
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
  const [setVinti, setSetVinti] = useState<Map<string, { A: number; B: number }>>(new Map());

  useEffect(() => {
    if (!partite) return;
    let attivo = true;
    caricaSetVinti(partite.map((m) => m.id))
      .then((r) => attivo && setSetVinti(r))
      .catch(() => undefined);
    return () => {
      attivo = false;
    };
  }, [partite]);

  function nomeSquadra(id: string) {
    return squadre?.find((s) => s.id === id)?.nome ?? id;
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <BarraNavigazione />
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Archivio partite</h1>
        <div className="flex gap-2">
          <Link to="/analisi" className="rounded-lg bg-slate-800 px-4 py-2 font-semibold hover:bg-slate-700">
            Analisi incontri
          </Link>
          <Link to="/partite/nuova" className="rounded-lg bg-blue-700 px-4 py-2 font-semibold hover:bg-blue-600">
            Nuova partita
          </Link>
        </div>
      </div>
      <table className="w-full text-left">
        <thead>
          <tr className="text-sm text-slate-400">
            <th className="pb-2">Data</th>
            <th className="pb-2">Squadra A</th>
            <th className="pb-2 text-center">Set</th>
            <th className="pb-2">Squadra B</th>
            <th className="pb-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {(partite ?? []).map((match) => {
            const vinti = setVinti.get(match.id) ?? { A: 0, B: 0 };
            return (
              <tr
                key={match.id}
                onClick={() => navigate(`/storico/${match.id}`)}
                className="cursor-pointer border-t border-slate-800 hover:bg-slate-800"
              >
                <td className="py-3">{match.data}</td>
                <td className="py-3">{nomeSquadra(match.squadraAId)}</td>
                <td className="py-3 text-center font-semibold">
                  {vinti.A} - {vinti.B}
                </td>
                <td className="py-3">{nomeSquadra(match.squadraBId)}</td>
                <td className="py-3 text-amber-400">{match.note}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}
