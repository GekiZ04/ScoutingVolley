import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { deriveSetState } from '@/domain/reducer';
import { calcolaStatistiche } from '@/domain/stats';
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from '@/features/export/exportCsv';
import { generaPdfReport, scaricaPdf } from '@/features/export/exportPdf';
import type { Azione, Fondamentale, Match, Player, SetPallavolo } from '@/domain/types';

const FONDAMENTALI: Fondamentale[] = ['battuta', 'ricezione', 'attacco', 'muro'];

interface RiepilogoSet {
  set: SetPallavolo;
  punteggioA: number;
  punteggioB: number;
}

export function MatchReportPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [riepilogoSet, setRiepilogoSet] = useState<RiepilogoSet[]>([]);
  const [azioniTotali, setAzioniTotali] = useState<Azione[]>([]);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const m = await db.matches.get(matchId);
      if (!m) return;
      setMatch(m);
      const [giocatoriA, giocatoriB] = await Promise.all([
        db.players.where('teamId').equals(m.squadraAId).toArray(),
        db.players.where('teamId').equals(m.squadraBId).toArray(),
      ]);
      setGiocatori([...giocatoriA, ...giocatoriB]);

      const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
      const riepiloghi: RiepilogoSet[] = [];
      const tutteLeAzioni: Azione[] = [];
      for (const set of sets) {
        const dati = await caricaDatiSet(set.id);
        const azioniPerRally = new Map<string, Azione[]>();
        for (const azione of dati.azioni) {
          const lista = azioniPerRally.get(azione.rallyId) ?? [];
          lista.push(azione);
          azioniPerRally.set(azione.rallyId, lista);
        }
        const stato = deriveSetState(set, dati.rallies, azioniPerRally, dati.sostituzioni);
        riepiloghi.push({ set, punteggioA: stato.punteggioA, punteggioB: stato.punteggioB });
        tutteLeAzioni.push(...dati.azioni);
      }
      setRiepilogoSet(riepiloghi);
      setAzioniTotali(tutteLeAzioni);
    })();
  }, [matchId]);

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-4 text-2xl font-bold">Report partita — {match.data}</h1>
      <div className="mb-4 flex gap-3">
        <button
          type="button"
          onClick={async () => scaricaCsv(`partita-${match.data}-azioni.csv`, await generaCsvAzioni(match.id))}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Esporta CSV azioni
        </button>
        <button
          type="button"
          onClick={async () => scaricaCsv(`partita-${match.data}-box-score.csv`, await generaCsvBoxScore(match.id))}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Esporta CSV box score
        </button>
        <button
          type="button"
          onClick={async () => scaricaPdf(`partita-${match.data}.pdf`, await generaPdfReport(match.id))}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Esporta PDF
        </button>
      </div>
      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Set</h2>
        <ul className="space-y-1">
          {riepilogoSet.map(({ set, punteggioA, punteggioB }) => (
            <li key={set.id} data-testid={`riepilogo-set-${set.numero}`}>
              Set {set.numero}: {punteggioA} - {punteggioB}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">Box score</h2>
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
                  const stats = calcolaStatistiche(azioniTotali, f, g.id);
                  return (
                    <td key={f} className="py-2" data-testid={`box-${g.id}-${f}`}>
                      {stats.tentativi > 0 ? `${stats.efficienzaPercento.toFixed(0)}% (${stats.tentativi})` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
