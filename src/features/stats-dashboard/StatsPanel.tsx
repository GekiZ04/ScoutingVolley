import { calcolaStatistiche, type FondamentaleStat } from '@/domain/stats';
import type { Azione, Player } from '@/domain/types';

const FONDAMENTALI: FondamentaleStat[] = ['battuta', 'ricezione', 'attacco', 'contrattacco', 'muro'];

// Battuta e ricezione si valutano in campo per punti/errori diretti (es. ace,
// battute sbagliate), non per un'efficienza percentuale — piu' difficile da
// leggere al volo durante una partita. Attacco/contrattacco/muro restano
// invece a efficienza, dove il rapporto pt-err e' l'indicatore che conta.
const FONDAMENTALI_SOLO_PUNTI_ERRORI: FondamentaleStat[] = ['battuta', 'ricezione'];

export function StatsPanel({
  azioni,
  giocatoriA,
  giocatoriB,
  onChiudi,
}: {
  azioni: Azione[];
  giocatoriA: Player[];
  giocatoriB: Player[];
  onChiudi: () => void;
}) {
  const squadre = [
    { titolo: 'Squadra A', giocatori: giocatoriA },
    { titolo: 'Squadra B', giocatori: giocatoriB },
  ];

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/80 p-6 text-white" data-testid="pannello-statistiche">
      <div className="mx-auto max-w-3xl rounded-xl bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Statistiche live</h2>
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2">
            Chiudi
          </button>
        </div>
        {squadre.map(({ titolo, giocatori }) => (
          <div key={titolo} className="mb-6">
            <h3 className="mb-2 text-xl font-semibold">{titolo}</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2">Giocatore</th>
                  {FONDAMENTALI.map((f) => (
                    <th key={f} className="pb-2 capitalize">{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {giocatori.map((g) => (
                  <tr key={g.id} className="border-t border-slate-700">
                    <td className="py-2">#{g.numero} {g.nome}</td>
                    {FONDAMENTALI.map((f) => {
                      const stats = calcolaStatistiche(azioni, f, g.id);
                      const testo =
                        stats.tentativi === 0
                          ? '—'
                          : FONDAMENTALI_SOLO_PUNTI_ERRORI.includes(f)
                            ? `Pt ${stats.perfetti} / Err ${stats.errori}`
                            : `${stats.efficienzaPercento.toFixed(0)}% (${stats.tentativi})`;
                      return (
                        <td key={f} className="py-2" data-testid={`stat-${g.id}-${f}`}>
                          {testo}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
