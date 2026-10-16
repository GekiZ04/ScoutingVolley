import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { eliminaPartita } from '@/db/matches';
import { caricaRiepilogoPartita, type RiepilogoSet } from '@/db/matchSummary';
import { contaSetVinti } from '@/domain/matchProgress';
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from '@/features/export/exportCsv';
import { generaPdfReport, scaricaPdf } from '@/features/export/exportPdf';
import { generaXlsxReport, scaricaXlsx } from '@/features/export/exportXlsx';
import type { Match, Player, Sostituzione, Team, Timeout } from '@/domain/types';
import { BarraNavigazione } from '@/components/BarraNavigazione';
import { percorsoRilevazione } from './riapriRilevazione';

export function MatchReportPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [match, setMatch] = useState<Match | null>(null);
  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [riepilogoSet, setRiepilogoSet] = useState<RiepilogoSet[]>([]);
  const [sostituzioni, setSostituzioni] = useState<Sostituzione[]>([]);
  const [timeouts, setTimeouts] = useState<Timeout[]>([]);
  const [nomi, setNomi] = useState<{ A: string; B: string }>({ A: 'Squadra A', B: 'Squadra B' });
  const [menuEsporta, setMenuEsporta] = useState(false);
  const [nonTrovata, setNonTrovata] = useState(false);
  const [erroreExport, setErroreExport] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        const dati = await caricaRiepilogoPartita(matchId);
        const { data } = await supabase
          .from('teams')
          .select('*')
          .in('id', [dati.match.squadraAId, dati.match.squadraBId]);
        const squadre = (data ?? []) as Team[];
        setNomi({
          A: squadre.find((t) => t.id === dati.match.squadraAId)?.nome ?? 'Squadra A',
          B: squadre.find((t) => t.id === dati.match.squadraBId)?.nome ?? 'Squadra B',
        });
        setMatch(dati.match);
        setGiocatori(dati.giocatori);
        setRiepilogoSet(dati.riepiloghi);
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
  const vinti = contaSetVinti(riepilogoSet.map((r) => r.set));

  async function handleExport(azione: () => Promise<void>) {
    try {
      setErroreExport(null);
      setMenuEsporta(false);
      await azione();
    } catch (e) {
      setErroreExport(e instanceof Error ? e.message : "Errore durante l'esportazione");
    }
  }

  async function handleRilevazione() {
    try {
      navigate(await percorsoRilevazione(match!.id, match!.formatoSet));
    } catch (e) {
      setErroreExport(e instanceof Error ? e.message : 'Errore nel caricamento dei set');
    }
  }

  async function handleElimina() {
    const titolo = `${match!.data} — ${nomi.A} vs ${nomi.B}`;
    if (!window.confirm(`Eliminare definitivamente la partita ${titolo}? Set, azioni e statistiche andranno persi.`)) return;
    try {
      await eliminaPartita(match!.id);
      navigate('/storico');
    } catch (e) {
      window.alert(`Eliminazione non riuscita: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const bottone = 'rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600';
  const voce = 'block w-full px-4 py-2 text-left text-sm hover:bg-slate-700';

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <BarraNavigazione />
      <p className="text-sm text-slate-400">{match.data}</p>
      <h1 className="mb-2 text-2xl font-bold">
        {nomi.A} <span className="text-slate-500">vs</span> {nomi.B}
      </h1>
      <p className="mb-2 text-5xl font-bold" data-testid="set-vinti">
        {vinti.A} - {vinti.B}
      </p>
      <p className="mb-4 text-lg text-slate-300" data-testid="parziali">
        {riepilogoSet.map((r) => `${r.punteggioA}-${r.punteggioB}`).join(' | ')}
      </p>
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
      <div className="mb-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => navigate(`/partite/${match.id}/tabellino`)} className={bottone}>
          Analisi
        </button>
        <button type="button" onClick={handleRilevazione} className={bottone}>
          Rilevazione
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuEsporta((v) => !v)}
            aria-expanded={menuEsporta}
            className={bottone}
          >
            Esporta
          </button>
          {menuEsporta && (
            <div className="absolute left-0 z-10 mt-1 w-56 rounded-lg bg-slate-800 py-1 shadow-lg">
              <button
                type="button"
                className={voce}
                onClick={() =>
                  handleExport(async () => scaricaCsv(`partita-${match.data}-azioni.csv`, await generaCsvAzioni(match.id)))
                }
              >
                Esporta CSV azioni
              </button>
              <button
                type="button"
                className={voce}
                onClick={() =>
                  handleExport(async () =>
                    scaricaCsv(`partita-${match.data}-box-score.csv`, await generaCsvBoxScore(match.id)),
                  )
                }
              >
                Esporta CSV box score
              </button>
              <button
                type="button"
                className={voce}
                onClick={() =>
                  handleExport(async () => scaricaPdf(`partita-${match.data}.pdf`, await generaPdfReport(match.id)))
                }
              >
                Esporta PDF
              </button>
              <button
                type="button"
                className={voce}
                onClick={() =>
                  handleExport(async () =>
                    scaricaXlsx(`partita-${match.data}-statistiche.xlsx`, await generaXlsxReport(match.id)),
                  )
                }
              >
                Esporta Excel statistiche
              </button>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleElimina}
          className="rounded-lg bg-red-900 px-4 py-2 text-sm font-semibold hover:bg-red-800"
        >
          Elimina
        </button>
      </div>
      <section>
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
    </main>
  );
}
