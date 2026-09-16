import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { aggiornaStatoSet, aggiornaStatoPartita } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { determinaPassoAtteso } from './flowLogic';
import { BattutaFlow } from './BattutaFlow';
import { RicezioneFlow } from './RicezioneFlow';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import { SubstitutionModal } from './SubstitutionModal';
import { StatsPanel } from '@/features/stats-dashboard/StatsPanel';
import { LiveAnalysisPanel } from '@/features/live-analysis/LiveAnalysisPanel';
import { squadraOpposta } from '@/domain/reducer';

export function LiveScoutingScreen() {
  const { matchId, setId } = useParams<{ matchId: string; setId: string }>();
  const navigate = useNavigate();
  const caricaSet = useLiveMatchStore((s) => s.caricaSet);
  const resetSet = useLiveMatchStore((s) => s.resetSet);
  const setCaricato = useLiveMatchStore((s) => s.set);
  const rallies = useLiveMatchStore((s) => s.rallies);
  const azioni = useLiveMatchStore((s) => s.azioni);
  const timeouts = useLiveMatchStore((s) => s.timeouts);
  const annullaUltimaAzione = useLiveMatchStore((s) => s.annullaUltimaAzione);
  const chiudiRallyManuale = useLiveMatchStore((s) => s.chiudiRallyManuale);
  const registraAzione = useLiveMatchStore((s) => s.registraAzione);
  const aggiungiSostituzione = useLiveMatchStore((s) => s.aggiungiSostituzione);
  const aggiungiTimeout = useLiveMatchStore((s) => s.aggiungiTimeout);
  const derivato = useLiveMatchStore((s) => (s.set ? s.statoDerivato() : null));
  const [errore, setErrore] = useState<string | null>(null);

  function segnalaErrore(e: unknown) {
    setErrore(e instanceof Error ? e.message : 'Errore di salvataggio');
  }

  const setRecord = useLiveQuery(() => db.sets.get(setId!), [setId]);
  const match = useLiveQuery(() => db.matches.get(matchId!), [matchId]);
  const giocatori = useLiveQuery(async () => {
    if (!match) return undefined;
    const [giocatoriA, giocatoriB] = await Promise.all([
      db.players.where('teamId').equals(match.squadraAId).toArray(),
      db.players.where('teamId').equals(match.squadraBId).toArray(),
    ]);
    return [...giocatoriA, ...giocatoriB];
  }, [match]);

  useEffect(() => {
    if (!setRecord) return;
    caricaDatiSet(setRecord.id).then((dati) => caricaSet({ set: setRecord, ...dati }));
  }, [setRecord, caricaSet]);

  const [sostituzioneAperta, setSostituzioneAperta] = useState(false);
  const [statisticheAperte, setStatisticheAperte] = useState(false);
  const [analisiAperta, setAnalisiAperta] = useState(false);

  if (!setCaricato || setCaricato.id !== setId || !derivato || !giocatori) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  const nomeGiocatore = (id: string) => {
    const giocatore = giocatori?.find((g) => g.id === id);
    return giocatore ? `#${giocatore.numero} ${giocatore.nome}` : id;
  };

  const rallyAperto = rallies.find((r) => r.numero === derivato.rallyApertoNumero);
  const azioniRallyAperto = rallyAperto ? azioni.filter((a) => a.rallyId === rallyAperto.id) : [];
  const passoAtteso = determinaPassoAtteso(azioniRallyAperto);

  const squadraRicevente = derivato.squadraAlServizio === 'A' ? 'B' : 'A';
  const rotazioneRicevente = squadraRicevente === 'A' ? derivato.rotazioneA : derivato.rotazioneB;
  const giocatoriInCampoRicezione = rotazioneRicevente
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const ultimaAzioneRallyAperto = azioniRallyAperto[azioniRallyAperto.length - 1];
  const squadraProtagonista = ultimaAzioneRallyAperto
    ? passoAtteso === 'attacco'
      ? ultimaAzioneRallyAperto.squadra
      : squadraOpposta(ultimaAzioneRallyAperto.squadra)
    : null;
  const rotazioneProtagonista =
    squadraProtagonista === 'A' ? derivato.rotazioneA : squadraProtagonista === 'B' ? derivato.rotazioneB : [];
  const giocatoriInCampoAttaccoMuro = rotazioneProtagonista
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const inCampoA = derivato.rotazioneA
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const inCampoB = derivato.rotazioneB
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const panchinaA = (giocatori ?? []).filter(
    (g) => g.teamId === match?.squadraAId && g.attivo && !derivato.rotazioneA.includes(g.id),
  );
  const panchinaB = (giocatori ?? []).filter(
    (g) => g.teamId === match?.squadraBId && g.attivo && !derivato.rotazioneB.includes(g.id),
  );
  const rosterA = (giocatori ?? []).filter((g) => g.teamId === match?.squadraAId);
  const rosterB = (giocatori ?? []).filter((g) => g.teamId === match?.squadraBId);

  const formatoSet = match?.formatoSet ?? 5;
  const setDecisivo = setRecord?.numero === formatoSet;
  const targetPunti = setDecisivo ? (match?.puntiSetDecisivo ?? 15) : (match?.puntiSet ?? 25);
  const setAlPunto =
    (derivato.punteggioA >= targetPunti || derivato.punteggioB >= targetPunti) &&
    Math.abs(derivato.punteggioA - derivato.punteggioB) >= 2;

  async function handleChiudiSet() {
    if (!setRecord || derivato!.punteggioA === derivato!.punteggioB) return;
    if (!window.confirm('Sei sicuro di voler chiudere il set?')) return;
    const vincitore = derivato!.punteggioA > derivato!.punteggioB ? 'A' : 'B';
    try {
      await aggiornaStatoSet(setRecord.id, 'concluso', vincitore);
    } catch (e) {
      segnalaErrore(e);
      return;
    }
    resetSet();
    navigate(`/partite/${matchId}/formazione`);
  }

  async function handleChiudiPartita() {
    if (!matchId) return;
    if (!window.confirm('Sei sicuro di voler chiudere la partita? Non potrai più modificarla.')) return;
    try {
      await aggiornaStatoPartita(matchId, 'conclusa');
    } catch (e) {
      segnalaErrore(e);
      return;
    }
    navigate('/storico');
  }

  const timeoutA = timeouts.filter((t) => t.squadra === 'A').length;
  const timeoutB = timeouts.filter((t) => t.squadra === 'B').length;

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 p-4 text-white">
      {errore && (
        <div
          role="alert"
          data-testid="banner-errore"
          onClick={() => setErrore(null)}
          className="mb-4 cursor-pointer rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold"
        >
          {errore} (tocca per chiudere)
        </div>
      )}
      <header className="mb-4 flex items-center justify-between rounded-lg bg-slate-900 px-6 py-4">
        <button
          type="button"
          onClick={() => annullaUltimaAzione().catch(segnalaErrore)}
          className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold"
        >
          Annulla ultima azione
        </button>
        <div className="text-3xl font-bold" data-testid="punteggio">
          {derivato.punteggioA} : {derivato.punteggioB}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_A').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Punto A
          </button>
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_B').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Punto B
          </button>
          <button
            type="button"
            onClick={() => setSostituzioneAperta(true)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Sostituzione
          </button>
          <button
            type="button"
            onClick={() => setStatisticheAperte(true)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Statistiche
          </button>
          <button
            type="button"
            onClick={() => setAnalisiAperta(true)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Analisi live
          </button>
          <button
            type="button"
            onClick={() => aggiungiTimeout('A').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
            data-testid="timeout-a"
          >
            Timeout A: {timeoutA}/2
          </button>
          <button
            type="button"
            onClick={() => aggiungiTimeout('B').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
            data-testid="timeout-b"
          >
            Timeout B: {timeoutB}/2
          </button>
          <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
            Chiudi set
          </button>
          <button type="button" onClick={handleChiudiPartita} className="rounded-lg bg-red-900 px-4 py-2 text-sm">
            Chiudi partita
          </button>
        </div>
      </header>
      {setAlPunto && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-700 px-4 py-3" data-testid="banner-fine-set">
          <span>
            Set al punto {derivato.punteggioA}-{derivato.punteggioB} — chiudere?
          </span>
          <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-amber-900 px-4 py-2 font-semibold">
            Chiudi set
          </button>
        </div>
      )}
      <section className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Squadra A in campo</h2>
          <div className="flex flex-wrap gap-2" data-testid="rotazione-a">
            {derivato.rotazioneA.map((giocatoreId, indice) => (
              <span key={giocatoreId} className="rounded bg-slate-800 px-3 py-1 text-sm">
                P{indice + 1}: {nomeGiocatore(giocatoreId)}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Squadra B in campo</h2>
          <div className="flex flex-wrap gap-2" data-testid="rotazione-b">
            {derivato.rotazioneB.map((giocatoreId, indice) => (
              <span key={giocatoreId} className="rounded bg-slate-800 px-3 py-1 text-sm">
                P{indice + 1}: {nomeGiocatore(giocatoreId)}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="flex-1 rounded-lg bg-slate-900 p-4" data-testid="area-tap-flow">
        {passoAtteso === 'battuta' && (
          <BattutaFlow
            onCompleta={(dati) => {
              const giocatoreId =
                derivato.squadraAlServizio === 'A' ? derivato.rotazioneA[0] : derivato.rotazioneB[0];
              registraAzione({
                squadra: derivato.squadraAlServizio,
                giocatoreId,
                fondamentale: 'battuta',
                ...dati,
              }).catch(segnalaErrore);
            }}
          />
        )}
        {passoAtteso === 'ricezione' && (
          <RicezioneFlow
            giocatoriInCampo={giocatoriInCampoRicezione}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraRicevente,
                fondamentale: 'ricezione',
                tipoBattuta: null,
                direzione: null,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
        {(passoAtteso === 'attacco' || passoAtteso === 'bivio') && squadraProtagonista && (
          <AttaccoMuroFlow
            mostraBivio={passoAtteso === 'bivio'}
            giocatoriInCampo={giocatoriInCampoAttaccoMuro}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraProtagonista,
                tipoBattuta: null,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
      </section>
      {sostituzioneAperta && (
        <SubstitutionModal
          inCampoA={inCampoA}
          inCampoB={inCampoB}
          panchinaA={panchinaA}
          panchinaB={panchinaB}
          onConferma={(dati) => {
            aggiungiSostituzione(dati).catch(segnalaErrore);
            setSostituzioneAperta(false);
          }}
          onChiudi={() => setSostituzioneAperta(false)}
        />
      )}
      {statisticheAperte && (
        <StatsPanel
          azioni={azioni}
          giocatoriA={rosterA}
          giocatoriB={rosterB}
          onChiudi={() => setStatisticheAperte(false)}
        />
      )}
      {analisiAperta && (
        <LiveAnalysisPanel
          azioni={azioni}
          giocatoriA={rosterA}
          giocatoriB={rosterB}
          onChiudi={() => setAnalisiAperta(false)}
        />
      )}
    </main>
  );
}
