import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { caricaRiepilogoPartita, type RiepilogoSet } from '@/db/matchSummary';
import { calcolaStatistiche, type FondamentaleStat } from '@/domain/stats';
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from '@/features/export/exportCsv';
import { generaPdfReport, scaricaPdf } from '@/features/export/exportPdf';
import type { Azione, Match, Player, Sostituzione, Timeout } from '@/domain/types';

const FONDAMENTALI: FondamentaleStat[] = ['battuta', 'ricezione', 'attacco', 'contrattacco', 'muro'];

export function MatchReportPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [riepilogoSet, setRiepilogoSet] = useState<RiepilogoSet[]>([]);
  const [azioniTotali, setAzioniTotali] = useState<Azione[]>([]);
  const [sostituzioni, setSostituzioni] = useState<Sostituzione[]>([]);
  const [timeouts, setTimeouts] = useState<Timeout[]>([]);
  const [nonTrovata, setNonTrovata] = useState(false);
  const [erroreExport, setErroreExport] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        const dati = await caricaRiepilogoPartita(matchId);
        setMatch(dati.match);
        setGiocatori(dati.giocatori);
        setRiepilogoSet(dati.riepiloghi);
        setAzioniTotali(dati.tutteLeAzioni);
        setSostituzioni(dati.tutteLeSostituzioni);
        setTimeouts(dati.tutteITimeout);
      } catch {
        setNonTrovata(true);
      }
    })();
  }, [matchId]);

  if (nonTrovata) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-white">
        <p>Partita non trovata.</p>
        <Link to="/storico" className="text-sm text-slate-400 hover:text-white">
          ← Torna allo storico
        </Link>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  const numeroSetPerSetId = new Map(riepilogoSet.map(({ set }) => [set.id, set.numero]));
  const nomeGiocatore = (id: string) => {
    const g = giocatori.find((p) => p.id === id);
    return g ? `#${g.numero} ${g.nome}` : id;
  };

  async function handleExport(azione: () => Promise<void>) {
    try {
      setErroreExport(null);
      await azione();
    } catch (e) {
      setErroreExport(e instanceof Error ? e.message : "Errore durante l'esportazione");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <Link to="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>
      <h1 className="mb-4 text-2xl font-bold">Report partita — {match.data}</h1>
      {erroreExport && (
        <div
          role="alert"
          data-testid="banner-errore-export"
          onClick={() => setErroreExport(null)}
          className="mb-4 cursor-pointer rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold"
        >
          {erroreExport} (tocca per chiudere)
        </div>
      )}
      <div className="mb-4 flex gap-3">
        <button
          type="button"
          onClick={() =>
            handleExport(async () => scaricaCsv(`partita-${match.data}-azioni.csv`, await generaCsvAzioni(match.id)))
          }
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Esporta CSV azioni
        </button>
        <button
          type="button"
          onClick={() =>
            handleExport(async () =>
              scaricaCsv(`partita-${match.data}-box-score.csv`, await generaCsvBoxScore(match.id)),
            )
          }
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
        >
          Esporta CSV box score
        </button>
        <button
          type="button"
          onClick={() =>
            handleExport(async () => scaricaPdf(`partita-${match.data}.pdf`, await generaPdfReport(match.id)))
          }
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
      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Sostituzioni e timeout</h2>
        {sostituzioni.length === 0 && timeouts.length === 0 ? (
          <p className="text-sm text-slate-400">Nessuna sostituzione o timeout registrati.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {sostituzioni.map((s) => (
              <li key={s.id} data-testid={`sostituzione-${s.id}`}>
                Set {numeroSetPerSetId.get(s.setId) ?? '?'}: sostituzione squadra {s.squadra}, giocatore{' '}
                {nomeGiocatore(s.giocatoreEsceId)} → {nomeGiocatore(s.giocatoreEntraId)} (dopo rally{' '}
                {s.dopoRallyNumero})
              </li>
            ))}
            {timeouts.map((t) => (
              <li key={t.id} data-testid={`timeout-${t.id}`}>
                Set {numeroSetPerSetId.get(t.setId) ?? '?'}: timeout squadra {t.squadra} (dopo rally{' '}
                {t.dopoRallyNumero})
              </li>
            ))}
          </ul>
        )}
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
