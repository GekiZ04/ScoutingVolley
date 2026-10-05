import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { caricaDatiSet, caricaAzioniPartita } from '@/db/scouting';
import { aggiornaStatoSet, aggiornaStatoPartita } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { determinaPassoAtteso, fasiSchema } from './flowLogic';
import { posizioniSchema } from '@/domain/schemaRicezione';
import type { PosizioniCampo } from '@/components/CampoDaGioco';
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
import {
  liberiCandidatiPerCambioAutomatico,
  cambioAutomaticoAttivo,
  rotazioneConCambioAutomatico,
} from '@/domain/liberoAutoSwap';
import { calcolaStatistiche, distribuzionePalleggio } from '@/domain/stats';
import type { Azione, Match, Player, SetPallavolo, Squadra } from '@/domain/types';

// Efficienza attacco "combinata" (primo attacco + contrattacco insieme): per
// il pannello di prima linea durante lo scouting live serve un unico numero
// per giocatore, non lo split usato negli export.
function efficienzaAttaccoCombinata(azioni: Azione[], giocatoreId: string) {
  const attacco = calcolaStatistiche(azioni, 'attacco', giocatoreId);
  const contrattacco = calcolaStatistiche(azioni, 'contrattacco', giocatoreId);
  const tentativi = attacco.tentativi + contrattacco.tentativi;
  const perfetti = attacco.perfetti + contrattacco.perfetti;
  const errori = attacco.errori + contrattacco.errori;
  const efficienzaPercento = tentativi === 0 ? 0 : ((perfetti - errori) / tentativi) * 100;
  return { tentativi, efficienzaPercento };
}

export function LiveScoutingScreen() {
  const { matchId, setId } = useParams<{ matchId: string; setId: string }>();
  const navigate = useNavigate();
  const caricaSet = useLiveMatchStore((s) => s.caricaSet);
  const resetSet = useLiveMatchStore((s) => s.resetSet);
  const setCaricato = useLiveMatchStore((s) => s.set);
  const rallies = useLiveMatchStore((s) => s.rallies);
  const azioni = useLiveMatchStore((s) => s.azioni);
  const sostituzioni = useLiveMatchStore((s) => s.sostituzioni);
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

  // Azioni di TUTTI i set della partita: a differenza di `azioni` (solo il
  // set caricato in live scouting), serve per le statistiche che devono
  // restare cumulate tra i set, come la distribuzione del palleggio.
  const azioniPartita = useSupabaseQuery<Azione[]>(
    async () => (matchId ? caricaAzioniPartita(matchId) : []),
    [matchId],
    ['sets', 'azioni'],
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
  // Quale dei (fino a) 2 liberi candidati e' davvero in campo ora per il
  // cambio automatico: null finche' l'utente non lo indica (vedi il prompt
  // piu' sotto). Si azzera ad ogni nuovo set, perche' le formazioni possono
  // cambiare da un set all'altro.
  const [liberoAttivoA, setLiberoAttivoA] = useState<string | null>(null);
  const [liberoAttivoB, setLiberoAttivoB] = useState<string | null>(null);
  useEffect(() => {
    setLiberoAttivoA(null);
    setLiberoAttivoB(null);
  }, [setId]);
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

  // Chi riceve e' schierato in ricezione prima della battuta; dopo la
  // ricezione entrambe le squadre vanno ai posti per ruolo (vedi fasiSchema).
  // Senza palleggiatore e giro del set restano le zone fisse.
  const fasi = fasiSchema(azioniRallyAperto, derivato.squadraAlServizio);
  const posizioniCampo: PosizioniCampo = {};
  for (const squadra of ['A', 'B'] as const) {
    const fase = fasi[squadra];
    if (!fase) continue;
    const eA = squadra === 'A';
    const punti = posizioniSchema({
      squadra,
      fase,
      rotazione: eA ? derivato.rotazioneA : derivato.rotazioneB,
      palleggiatoreId: (eA ? setRecord?.paleggiatoreIdA : setRecord?.paleggiatoreIdB) ?? null,
      giro: (eA ? setRecord?.giroA : setRecord?.giroB) ?? null,
    });
    if (punti) posizioniCampo[squadra] = punti;
  }

  const squadraRicevente = derivato.squadraAlServizio === 'A' ? 'B' : 'A';

  const ultimaAzioneRallyAperto = azioniRallyAperto[azioniRallyAperto.length - 1];

  const rosterA = (giocatori ?? []).filter((g) => g.teamId === match?.squadraAId);
  const rosterB = (giocatori ?? []).filter((g) => g.teamId === match?.squadraBId);

  // Cambio automatico centrale<->libero in seconda linea (facoltativo, attivo
  // solo se in "Formazione titolare" sono stati indicati palleggiatore e
  // giro per la squadra): rotazioneEffettiva* e' quella davvero mostrata e
  // selezionabile sul campo, derivato.rotazione* resta la rotazione "reale"
  // usata per punteggio e per chi deve servire.
  const candidatiLiberoA = liberiCandidatiPerCambioAutomatico(match?.liberiSelezionatiA ?? null, rosterA.filter((g) => g.attivo));
  const candidatiLiberoB = liberiCandidatiPerCambioAutomatico(match?.liberiSelezionatiB ?? null, rosterB.filter((g) => g.attivo));
  // Con 1 solo candidato si usa direttamente lui; con 2 serve la scelta
  // esplicita dell'utente (liberoAttivo*), col primo come default finche'
  // non risponde al prompt sotto.
  const liberoAutoA = liberoAttivoA ?? candidatiLiberoA[0] ?? null;
  const liberoAutoB = liberoAttivoB ?? candidatiLiberoB[0] ?? null;
  const rotazioneEffettivaA = rotazioneConCambioAutomatico(
    derivato.rotazioneA,
    setRecord?.paleggiatoreIdA ?? null,
    setRecord?.giroA ?? null,
    liberoAutoA,
    derivato.squadraAlServizio === 'A',
  );
  const rotazioneEffettivaB = rotazioneConCambioAutomatico(
    derivato.rotazioneB,
    setRecord?.paleggiatoreIdB ?? null,
    setRecord?.giroB ?? null,
    liberoAutoB,
    derivato.squadraAlServizio === 'B',
  );
  // Serve chiedere quale libero e' entrato quando il cambio automatico e'
  // attivo (un centrale e' in zona 5/6, o in zona 1 ma la squadra sta
  // ricevendo), la squadra ha 2 candidati e nessuno e' ancora stato scelto
  // esplicitamente per questo set.
  const serveSceltaLiberoA =
    candidatiLiberoA.length === 2 &&
    liberoAttivoA === null &&
    cambioAutomaticoAttivo(
      derivato.rotazioneA, setRecord?.paleggiatoreIdA ?? null, setRecord?.giroA ?? null,
      derivato.squadraAlServizio === 'A',
    );
  const serveSceltaLiberoB =
    candidatiLiberoB.length === 2 &&
    liberoAttivoB === null &&
    cambioAutomaticoAttivo(
      derivato.rotazioneB, setRecord?.paleggiatoreIdB ?? null, setRecord?.giroB ?? null,
      derivato.squadraAlServizio === 'B',
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

  // Il muro non e' mai scelto a parte dallo scout: e' sempre appaiato a un
  // attacco toccato a rete (vedi AttaccoMuroFlow), quindi quando l'ultima
  // azione e' un muro mostra/corregge l'attacco appaiato invece del muro
  // stesso, che altrimenti resterebbe irraggiungibile dalla striscia di
  // correzione.
  const ultimaAzione = azioni[azioni.length - 1];
  const attaccoAppaiatoAMuro =
    ultimaAzione && ultimaAzione.fondamentale === 'muro'
      ? azioni.find(
          (a) => a.rallyId === ultimaAzione.rallyId && a.fondamentale === 'attacco' && a.ordine === ultimaAzione.ordine - 1,
        )
      : undefined;
  const azioneDaCorreggere = attaccoAppaiatoAMuro ?? ultimaAzione;

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
        toccoMuro: ultimaAzioneConTraiettoria.toccoMuro,
      }
    : null;

  // Zone 2/3/4 = indici 1..3 della rotazione (zona = indice+1): prima linea
  // attuale, indipendente dal cambio automatico libero (che tocca solo le
  // zone 5/6 di seconda linea).
  const primaLineaA = derivato.rotazioneA.slice(1, 4);
  const primaLineaB = derivato.rotazioneB.slice(1, 4);
  // Zone 1/5/6 = indici 0,4,5: seconda linea attuale (chi riceve e puo'
  // contrattaccare da dietro), stessa logica della prima linea sopra.
  const secondaLineaA = [derivato.rotazioneA[0], derivato.rotazioneA[4], derivato.rotazioneA[5]];
  const secondaLineaB = [derivato.rotazioneB[0], derivato.rotazioneB[4], derivato.rotazioneB[5]];

  // Cumulata su tutta la partita (tutti i set), non solo il set in corso.
  const distribuzioneA = distribuzionePalleggio(azioniPartita ?? [], 'A');
  const distribuzioneB = distribuzionePalleggio(azioniPartita ?? [], 'B');

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
  // Il cambio libero<->libero (bottone dedicato sotto) non passa da
  // aggiungiSostituzione, quindi non finisce mai in questo conteggio.
  const sostituzioniA = sostituzioni.filter((s) => s.squadra === 'A').length;
  const sostituzioniB = sostituzioni.filter((s) => s.squadra === 'B').length;

  function altroLibero(candidati: string[], attuale: string | null): string {
    return candidati.find((id) => id !== attuale) ?? candidati[0];
  }

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
        <div className="flex flex-col items-center">
          <div
            className="text-xs font-semibold uppercase tracking-wide text-slate-400"
            data-testid="indicatore-set"
          >
            Set {setRecord?.numero ?? '—'} / {formatoSet}
            {setDecisivo && <span className="ml-1 text-amber-400">(decisivo)</span>}
          </div>
          <div className="flex items-center gap-2 text-2xl font-bold" data-testid="punteggio">
            <span className="w-4 text-center" data-testid="indicatore-servizio-a">
              {derivato.squadraAlServizio === 'A' ? '🏐' : ''}
            </span>
            {derivato.punteggioA} : {derivato.punteggioB}
            <span className="w-4 text-center" data-testid="indicatore-servizio-b">
              {derivato.squadraAlServizio === 'B' ? '🏐' : ''}
            </span>
          </div>
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
          <span className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs" data-testid="sostituzioni-a">
            Sostituzioni A: {sostituzioniA}/6
          </span>
          <span className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs" data-testid="sostituzioni-b">
            Sostituzioni B: {sostituzioniB}/6
          </span>
          {candidatiLiberoA.length === 2 && (
            <button
              type="button"
              onClick={() => setLiberoAttivoA(altroLibero(candidatiLiberoA, liberoAutoA))}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
              data-testid="scambia-libero-a"
            >
              Libero A ⇄ {nomeGiocatore(liberoAutoA!)}
            </button>
          )}
          {candidatiLiberoB.length === 2 && (
            <button
              type="button"
              onClick={() => setLiberoAttivoB(altroLibero(candidatiLiberoB, liberoAutoB))}
              className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs"
              data-testid="scambia-libero-b"
            >
              Libero B ⇄ {nomeGiocatore(liberoAutoB!)}
            </button>
          )}
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
      <div className="flex min-h-0 flex-1 gap-2">
      <section className="min-h-0 flex-[3] rounded-lg bg-slate-900 p-2" data-testid="area-tap-flow">
        {passoAtteso === 'battuta' && (
          <BattutaFlow
            key={`${derivato.rallyApertoNumero}-${azioniRallyAperto.length}`}
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            squadraRicevente={squadraRicevente}
            ultimaTraiettoria={ultimaTraiettoria}
            posizioni={posizioniCampo}
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
            posizioni={posizioniCampo}
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
        {passoAtteso === 'attacco' && ultimaAzioneRallyAperto && (
          <AttaccoMuroFlow
            key={`${derivato.rallyApertoNumero}-${azioniRallyAperto.length}`}
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            ultimaTraiettoria={ultimaTraiettoria}
            posizioni={posizioniCampo}
            onCompleta={(dati, tocco) => {
              (async () => {
                if (tocco) {
                  // Il muro non e' mai scelto a parte dallo scout come passo
                  // iniziale: e' sempre appaiato a un attacco toccato a rete,
                  // ma chi ha murato e dove e' finita la palla dopo vengono
                  // comunque chiesti (vedi AttaccoMuroFlow).
                  await registraDueAzioni(
                    { tipoBattuta: null, ...dati },
                    {
                      squadra: squadraOpposta(dati.squadra),
                      giocatoreId: tocco.giocatoreId,
                      fondamentale: 'muro',
                      tipoBattuta: null,
                      valutazione: tocco.valutazione,
                      origine: tocco.origine,
                      destinazione: tocco.origine,
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
      <aside className="w-44 shrink-0 overflow-y-auto rounded-lg bg-slate-900 p-2 text-xs">
        <div data-testid="efficienza-prima-linea">
          <h3 className="mb-1 font-semibold text-blue-400">Prima linea A</h3>
          <ul className="mb-3 space-y-1">
            {primaLineaA.map((id) => {
              const eff = efficienzaAttaccoCombinata(azioni, id);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{nomeGiocatore(id)}</span>
                  <span className="shrink-0 text-slate-300">
                    {eff.tentativi > 0 ? `${eff.efficienzaPercento.toFixed(0)}% (${eff.tentativi})` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
          <h3 className="mb-1 font-semibold text-orange-400">Prima linea B</h3>
          <ul className="space-y-1">
            {primaLineaB.map((id) => {
              const eff = efficienzaAttaccoCombinata(azioni, id);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{nomeGiocatore(id)}</span>
                  <span className="shrink-0 text-slate-300">
                    {eff.tentativi > 0 ? `${eff.efficienzaPercento.toFixed(0)}% (${eff.tentativi})` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div data-testid="efficienza-seconda-linea" className="mt-3 border-t border-slate-800 pt-2">
          <h3 className="mb-1 font-semibold text-blue-400">Seconda linea A</h3>
          <ul className="mb-3 space-y-1">
            {secondaLineaA.map((id) => {
              const eff = efficienzaAttaccoCombinata(azioni, id);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{nomeGiocatore(id)}</span>
                  <span className="shrink-0 text-slate-300">
                    {eff.tentativi > 0 ? `${eff.efficienzaPercento.toFixed(0)}% (${eff.tentativi})` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
          <h3 className="mb-1 font-semibold text-orange-400">Seconda linea B</h3>
          <ul className="space-y-1">
            {secondaLineaB.map((id) => {
              const eff = efficienzaAttaccoCombinata(azioni, id);
              return (
                <li key={id} className="flex items-center justify-between gap-2">
                  <span className="truncate">{nomeGiocatore(id)}</span>
                  <span className="shrink-0 text-slate-300">
                    {eff.tentativi > 0 ? `${eff.efficienzaPercento.toFixed(0)}% (${eff.tentativi})` : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <div data-testid="distribuzione-palleggio" className="mt-3 border-t border-slate-800 pt-2">
          <h3 className="mb-1 font-semibold text-blue-400">Distribuzione palleggio A</h3>
          <ul className="mb-3 space-y-1">
            {distribuzioneA.length === 0 && <li className="text-slate-500">—</li>}
            {distribuzioneA.map((riga) => (
              <li key={riga.giocatoreId} className="flex items-center justify-between gap-2">
                <span className="truncate">{nomeGiocatore(riga.giocatoreId)}</span>
                <span className="shrink-0 text-slate-300">
                  {riga.percentuale.toFixed(0)}% ({riga.tentativi})
                </span>
              </li>
            ))}
          </ul>
          <h3 className="mb-1 font-semibold text-orange-400">Distribuzione palleggio B</h3>
          <ul className="space-y-1">
            {distribuzioneB.length === 0 && <li className="text-slate-500">—</li>}
            {distribuzioneB.map((riga) => (
              <li key={riga.giocatoreId} className="flex items-center justify-between gap-2">
                <span className="truncate">{nomeGiocatore(riga.giocatoreId)}</span>
                <span className="shrink-0 text-slate-300">
                  {riga.percentuale.toFixed(0)}% ({riga.tentativi})
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      </div>
      {azioneDaCorreggere && (
        <StrisciaUltimaAzione
          azione={azioneDaCorreggere}
          onCorreggi={(v) => correggiValutazione(azioneDaCorreggere.id, v).catch(segnalaErrore)}
        />
      )}
      {(serveSceltaLiberoA || serveSceltaLiberoB) && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70" data-testid="modal-scelta-libero">
          <div className="w-full max-w-md rounded-xl bg-slate-900 p-6 text-center text-white">
            <h2 className="mb-4 text-xl font-bold">
              Quale libero è entrato ({serveSceltaLiberoA ? 'Squadra A' : 'Squadra B'})?
            </h2>
            <div className="flex justify-center gap-3">
              {(serveSceltaLiberoA ? candidatiLiberoA : candidatiLiberoB).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => (serveSceltaLiberoA ? setLiberoAttivoA(id) : setLiberoAttivoB(id))}
                  className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold"
                >
                  {nomeGiocatore(id)}
                </button>
              ))}
            </div>
          </div>
        </div>
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
