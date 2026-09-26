import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { caricaDatiSet } from '@/db/scouting';
import { aggiornaStatoSet, aggiornaStatoPartita } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { determinaPassoAtteso } from './flowLogic';
import { BattutaFlow } from './BattutaFlow';
import { RicezioneFlow } from './RicezioneFlow';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import { SubstitutionModal } from './SubstitutionModal';
import { StrisciaUltimaAzione } from './StrisciaUltimaAzione';
import { StatsPanel } from '@/features/stats-dashboard/StatsPanel';
import { LiveAnalysisPanel } from '@/features/live-analysis/LiveAnalysisPanel';
import { squadraOpposta, determinaEsitoAutomatico } from '@/domain/reducer';
import { giocatoreEleggibileLibero } from '@/domain/liberi';
import { contaSetVinti, squadraCheHaVintoLaPartita } from '@/domain/matchProgress';
import { liberoDaUsarePerCambioAutomatico, rotazioneConCambioAutomatico } from '@/domain/liberoAutoSwap';
import type { Match, Player, SetPallavolo, Squadra } from '@/domain/types';

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
  const registraDueAzioni = useLiveMatchStore((s) => s.registraDueAzioni);
  const aggiungiSostituzione = useLiveMatchStore((s) => s.aggiungiSostituzione);
  const aggiungiTimeout = useLiveMatchStore((s) => s.aggiungiTimeout);
  const correggiValutazione = useLiveMatchStore((s) => s.correggiValutazione);
  const derivato = useLiveMatchStore((s) => (s.set ? s.statoDerivato() : null));
  const [errore, setErrore] = useState<string | null>(null);

  function segnalaErrore(e: unknown) {
    setErrore(e instanceof Error ? e.message : 'Errore di salvataggio');
  }

  const setRecord = useSupabaseQuery<SetPallavolo | null>(
    async () => {
      const { data, error } = await supabase.from('sets').select('*').eq('id', setId!).maybeSingle();
      if (error) throw error;
      return data as SetPallavolo | null;
    },
    [setId],
    ['sets'],
  );
  const match = useSupabaseQuery<Match | null>(
    async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('id', matchId!).maybeSingle();
      if (error) throw error;
      return data as Match | null;
    },
    [matchId],
    ['matches'],
  );
  const giocatori = useSupabaseQuery<Player[] | undefined>(
    async () => {
      if (!match) return undefined;
      const [giocatoriARes, giocatoriBRes] = await Promise.all([
        supabase.from('players').select('*').eq('teamId', match.squadraAId),
        supabase.from('players').select('*').eq('teamId', match.squadraBId),
      ]);
      if (giocatoriARes.error) throw giocatoriARes.error;
      if (giocatoriBRes.error) throw giocatoriBRes.error;
      return [...(giocatoriARes.data as Player[]), ...(giocatoriBRes.data as Player[])];
    },
    [match],
    ['players'],
  );
  const setDellaPartita = useSupabaseQuery<SetPallavolo[]>(
    async () => {
      if (!matchId) return [];
      const { data, error } = await supabase.from('sets').select('*').eq('matchId', matchId).order('numero');
      if (error) throw error;
      return data as SetPallavolo[];
    },
    [matchId],
    ['sets'],
  );

  // Ricarica lo stato del set (rallies/azioni/sostituzioni/timeout) dal DB
  // condiviso e ripopola lo store ogni volta che qualcosa cambia per questo
  // set — incluse le azioni registrate dall'ALTRO dispositivo in tempo reale.
  useSupabaseQuery<null>(
    async () => {
      if (!setRecord) return null;
      const dati = await caricaDatiSet(setRecord.id);
      caricaSet({ set: setRecord, ...dati });
      return null;
    },
    [setRecord?.id],
    ['rallies', 'azioni', 'sostituzioni', 'timeouts'],
  );

  const [sostituzioneAperta, setSostituzioneAperta] = useState(false);
  const [statisticheAperte, setStatisticheAperte] = useState(false);
  const [analisiAperta, setAnalisiAperta] = useState(false);
  const [notificaPartitaDecisa, setNotificaPartitaDecisa] = useState<{
    vincitore: Squadra;
    setVintiA: number;
    setVintiB: number;
  } | null>(null);

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

  const ultimaAzioneRallyAperto = azioniRallyAperto[azioniRallyAperto.length - 1];
  const squadraProtagonista = ultimaAzioneRallyAperto
    ? passoAtteso === 'attacco'
      ? ultimaAzioneRallyAperto.squadra
      : squadraOpposta(ultimaAzioneRallyAperto.squadra)
    : null;

  const rosterA = (giocatori ?? []).filter((g) => g.teamId === match?.squadraAId);
  const rosterB = (giocatori ?? []).filter((g) => g.teamId === match?.squadraBId);

  // Cambio automatico centrale<->libero in seconda linea (facoltativo, attivo
  // solo se in "Formazione titolare" sono stati indicati palleggiatore e
  // giro per la squadra): rotazioneEffettiva* e' quella davvero mostrata e
  // selezionabile sul campo, derivato.rotazione* resta la rotazione "reale"
  // usata per punteggio e per chi deve servire.
  const liberoAutoA = liberoDaUsarePerCambioAutomatico(match?.liberiSelezionatiA ?? null, rosterA.filter((g) => g.attivo));
  const liberoAutoB = liberoDaUsarePerCambioAutomatico(match?.liberiSelezionatiB ?? null, rosterB.filter((g) => g.attivo));
  const rotazioneEffettivaA = rotazioneConCambioAutomatico(
    derivato.rotazioneA,
    setRecord?.paleggiatoreIdA ?? null,
    setRecord?.giroA ?? null,
    liberoAutoA,
  );
  const rotazioneEffettivaB = rotazioneConCambioAutomatico(
    derivato.rotazioneB,
    setRecord?.paleggiatoreIdB ?? null,
    setRecord?.giroB ?? null,
    liberoAutoB,
  );

  const inCampoA = rotazioneEffettivaA
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const inCampoB = rotazioneEffettivaB
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const panchinaA = (giocatori ?? []).filter(
    (g) =>
      g.teamId === match?.squadraAId &&
      g.attivo &&
      !rotazioneEffettivaA.includes(g.id) &&
      giocatoreEleggibileLibero(g, match?.liberiSelezionatiA ?? null),
  );
  const panchinaB = (giocatori ?? []).filter(
    (g) =>
      g.teamId === match?.squadraBId &&
      g.attivo &&
      !rotazioneEffettivaB.includes(g.id) &&
      giocatoreEleggibileLibero(g, match?.liberiSelezionatiB ?? null),
  );

  const ultimaAzioneConTraiettoria = [...azioni].reverse().find((a) => a.origine && a.destinazione);
  const esitoUltimaTraiettoria = ultimaAzioneConTraiettoria
    ? determinaEsitoAutomatico([ultimaAzioneConTraiettoria])
    : null;
  const ultimaTraiettoria = ultimaAzioneConTraiettoria
    ? {
        origine: ultimaAzioneConTraiettoria.origine!,
        destinazione: ultimaAzioneConTraiettoria.destinazione!,
        esito: (esitoUltimaTraiettoria === null
          ? 'continua'
          : esitoUltimaTraiettoria === (ultimaAzioneConTraiettoria.squadra === 'A' ? 'punto_A' : 'punto_B')
            ? 'punto_esecutore'
            : 'punto_avversario') as 'punto_esecutore' | 'continua' | 'punto_avversario',
      }
    : null;

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

    const setPrecedentiConclusi = (setDellaPartita ?? []).filter(
      (s) => s.id !== setRecord.id && s.stato === 'concluso',
    );
    const { A: setVintiAPrecedenti, B: setVintiBPrecedenti } = contaSetVinti(setPrecedentiConclusi);
    const setVintiA = setVintiAPrecedenti + (vincitore === 'A' ? 1 : 0);
    const setVintiB = setVintiBPrecedenti + (vincitore === 'B' ? 1 : 0);
    const vincitorePartita = squadraCheHaVintoLaPartita(setVintiA, setVintiB, formatoSet);

    if (vincitorePartita) {
      // Il set resta caricato nello store finche' l'utente non sceglie
      // un'azione dalla notifica: azzerarlo subito farebbe sparire lo
      // schermo (mostrerebbe "Caricamento...") prima che la notifica stessa
      // possa essere mostrata.
      setNotificaPartitaDecisa({ vincitore: vincitorePartita, setVintiA, setVintiB });
    } else {
      resetSet();
      navigate(`/partite/${matchId}/formazione`);
    }
  }

  async function handleChiudiPartitaDaNotifica() {
    if (!matchId) return;
    try {
      await aggiornaStatoPartita(matchId, 'conclusa');
    } catch (e) {
      segnalaErrore(e);
      return;
    }
    resetSet();
    navigate('/storico');
  }

  function handleContinuaDopoNotifica() {
    setNotificaPartitaDecisa(null);
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
    <main className="flex h-screen flex-col overflow-hidden bg-slate-950 p-2 text-white">
      {errore && (
        <div
          role="alert"
          data-testid="banner-errore"
          onClick={() => setErrore(null)}
          className="mb-2 cursor-pointer rounded-lg bg-red-700 px-3 py-1.5 text-sm font-semibold"
        >
          {errore} (tocca per chiudere)
        </div>
      )}
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900 px-3 py-1.5">
        <button
          type="button"
          onClick={() => annullaUltimaAzione().catch(segnalaErrore)}
          className="rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold"
        >
          Annulla ultima azione
        </button>
        <div className="text-2xl font-bold" data-testid="punteggio">
          {derivato.punteggioA} : {derivato.punteggioB}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_A').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
          >
            Punto A
          </button>
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_B').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
          >
            Punto B
          </button>
          <button
            type="button"
            onClick={() => setSostituzioneAperta(true)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
          >
            Sostituzione
          </button>
          <button
            type="button"
            onClick={() => setStatisticheAperte(true)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
          >
            Statistiche
          </button>
          <button
            type="button"
            onClick={() => setAnalisiAperta(true)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
          >
            Analisi live
          </button>
          <button
            type="button"
            onClick={() => aggiungiTimeout('A').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
            data-testid="timeout-a"
          >
            Timeout A: {timeoutA}/2
          </button>
          <button
            type="button"
            onClick={() => aggiungiTimeout('B').catch(segnalaErrore)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
            data-testid="timeout-b"
          >
            Timeout B: {timeoutB}/2
          </button>
          <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs">
            Chiudi set
          </button>
          <button type="button" onClick={handleChiudiPartita} className="rounded-lg bg-red-900 px-3 py-1.5 text-xs">
            Chiudi partita
          </button>
        </div>
      </header>
      {setAlPunto && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-amber-700 px-3 py-1.5 text-sm" data-testid="banner-fine-set">
          <span>
            Set al punto {derivato.punteggioA}-{derivato.punteggioB} — chiudere?
          </span>
          <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-amber-900 px-3 py-1 font-semibold">
            Chiudi set
          </button>
        </div>
      )}
      <section className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs">
        <div className="flex flex-wrap items-center gap-1" data-testid="rotazione-a">
          <span className="mr-1 font-semibold text-blue-400">A</span>
          {rotazioneEffettivaA.map((giocatoreId, indice) => (
            <span key={giocatoreId} className="rounded bg-slate-800 px-1.5 py-0.5">
              P{indice + 1}: {nomeGiocatore(giocatoreId)}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1" data-testid="rotazione-b">
          <span className="mr-1 font-semibold text-orange-400">B</span>
          {rotazioneEffettivaB.map((giocatoreId, indice) => (
            <span key={giocatoreId} className="rounded bg-slate-800 px-1.5 py-0.5">
              P{indice + 1}: {nomeGiocatore(giocatoreId)}
            </span>
          ))}
        </div>
      </section>
      <section className="min-h-0 flex-1 rounded-lg bg-slate-900 p-2" data-testid="area-tap-flow">
        {passoAtteso === 'battuta' && (
          <BattutaFlow
            key={`${derivato.rallyApertoNumero}-${azioniRallyAperto.length}`}
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            squadraRicevente={squadraRicevente}
            ultimaTraiettoria={ultimaTraiettoria}
            onCompleta={(dati, ricezione) => {
              const giocatoreId =
                derivato.squadraAlServizio === 'A' ? derivato.rotazioneA[0] : derivato.rotazioneB[0];
              const azioneBattuta = {
                squadra: derivato.squadraAlServizio,
                giocatoreId,
                fondamentale: 'battuta' as const,
                toccoMuro: false,
                ...dati,
              };
              if (ricezione) {
                registraDueAzioni(azioneBattuta, {
                  squadra: squadraRicevente,
                  fondamentale: 'ricezione',
                  tipoBattuta: null,
                  toccoMuro: false,
                  origine: null,
                  destinazione: null,
                  ...ricezione,
                }).catch(segnalaErrore);
              } else {
                registraAzione(azioneBattuta).catch(segnalaErrore);
              }
            }}
          />
        )}
        {passoAtteso === 'ricezione' && (
          <RicezioneFlow
            key={`${derivato.rallyApertoNumero}-${azioniRallyAperto.length}`}
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            squadraRicevente={squadraRicevente}
            ultimaTraiettoria={ultimaTraiettoria}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraRicevente,
                fondamentale: 'ricezione',
                tipoBattuta: null,
                toccoMuro: false,
                origine: null,
                destinazione: null,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
        {(passoAtteso === 'attacco' || passoAtteso === 'bivio') && squadraProtagonista && (
          <AttaccoMuroFlow
            key={`${derivato.rallyApertoNumero}-${azioniRallyAperto.length}`}
            mostraBivio={passoAtteso === 'bivio'}
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            ultimaTraiettoria={ultimaTraiettoria}
            onCompleta={(dati, tocco) => {
              (async () => {
                if (tocco) {
                  await registraDueAzioni(
                    { tipoBattuta: null, ...dati },
                    {
                      squadra: squadraOpposta(dati.squadra),
                      giocatoreId: tocco.giocatoreId,
                      fondamentale: 'muro',
                      tipoBattuta: null,
                      valutazione: tocco.valutazione,
                      origine: tocco.origine,
                      destinazione: dati.destinazione,
                      toccoMuro: false,
                    },
                  );
                } else {
                  await registraAzione({ tipoBattuta: null, ...dati });
                }
              })().catch(segnalaErrore);
            }}
          />
        )}
      </section>
      {azioni.length > 0 && (
        <StrisciaUltimaAzione
          azione={azioni[azioni.length - 1]}
          onCorreggi={(v) => correggiValutazione(azioni[azioni.length - 1].id, v).catch(segnalaErrore)}
        />
      )}
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
      {notificaPartitaDecisa && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70" data-testid="modal-partita-decisa">
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 text-center text-white">
            <h2 className="mb-2 text-xl font-bold">
              Squadra {notificaPartitaDecisa.vincitore} ha vinto la partita!
            </h2>
            <p className="mb-6 text-slate-300">
              {notificaPartitaDecisa.setVintiA} - {notificaPartitaDecisa.setVintiB} set: la partita è decisa.
              Vuoi chiuderla ora o continuare a giocare un altro set?
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={handleChiudiPartitaDaNotifica}
                className="rounded-lg bg-red-800 px-5 py-2.5 font-semibold"
              >
                Chiudi partita
              </button>
              <button
                type="button"
                onClick={handleContinuaDopoNotifica}
                className="rounded-lg bg-slate-700 px-5 py-2.5 font-semibold"
              >
                Continua
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
