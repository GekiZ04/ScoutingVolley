import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type {
  Azione,
  CorrezionePunteggio,
  Rally,
  SetPallavolo,
  Sostituzione,
  Timeout,
  Squadra,
} from '@/domain/types';
import { deriveSetState, raggruppaPerRally, type SetStatoDerivato } from '@/domain/reducer';
import { ruotaFormazione } from '@/domain/rotation';
import { trovaUltimoAnnullabile } from '@/domain/annulla';
import { derivaValutazioneBattutaDaRicezione, derivaValutazioneMuroDaAttacco } from '@/domain/valutazioneAutomatica';
import {
  salvaRally,
  aggiornaRallyEsito,
  salvaAzione,
  aggiornaValutazioneAzione,
  eliminaAzioni,
  eliminaRallySeVuoto,
  salvaSostituzione,
  eliminaSostituzione,
  salvaTimeout,
  eliminaTimeout,
  salvaCorrezionePunteggio,
  eliminaCorrezionePunteggio,
} from '@/db/scouting';
import { aggiornaFormazioneIniziale } from '@/db/matches';

interface DatiSetIniziali {
  set: SetPallavolo;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
  correzioniPunteggio?: CorrezionePunteggio[];
}

type InputAzione = Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>;

interface LiveMatchState {
  set: SetPallavolo | null;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
  correzioniPunteggio: CorrezionePunteggio[];
  // Vero mentre un salvataggio e' in corso: in quel momento un secondo tocco
  // viene ignorato (e la UI disabilita i pulsanti), altrimenti il doppio
  // tocco crea due rally con lo stesso numero e il punto salta di due.
  occupato: boolean;
  caricaSet: (dati: DatiSetIniziali) => void;
  sostituisciSet: (nuovo: SetPallavolo) => void;
  resetSet: () => void;
  statoDerivato: () => SetStatoDerivato;
  registraAzione: (input: InputAzione) => Promise<void>;
  registraDueAzioni: (input1: InputAzione, input2: InputAzione) => Promise<void>;
  annullaUltimaAzione: () => Promise<void>;
  chiudiRallyManuale: (esito: 'punto_A' | 'punto_B') => Promise<void>;
  aggiungiSostituzione: (input: Omit<Sostituzione, 'id' | 'setId' | 'dopoRallyNumero'>) => Promise<void>;
  aggiungiTimeout: (squadra: Squadra) => Promise<void>;
  correggiValutazione: (azioneId: string, nuovaValutazione: Azione['valutazione']) => Promise<void>;
  ruotaSquadra: (squadra: Squadra, passi: number) => Promise<void>;
  correggiPunteggio: (punteggioA: number, punteggioB: number) => Promise<void>;
}

// Dopo un salvataggio un evento realtime puo' aver gia' ricaricato lo stesso
// elemento dal database: aggiungere per id evita di averlo due volte.
function aggiungiUnici<T extends { id: string }>(lista: T[], nuovi: T[]): T[] {
  const presenti = new Set(lista.map((x) => x.id));
  return [...lista, ...nuovi.filter((x) => !presenti.has(x.id))];
}

// I gesti da due azioni (battuta+ricezione, attacco+muro) condividono il
// timestamp: serve a riconoscerli, quindi due gesti diversi non devono mai
// averne uno uguale nemmeno se registrati nello stesso millisecondo.
let ultimoTimestampMs = 0;
function timestampUnico(): string {
  ultimoTimestampMs = Math.max(Date.now(), ultimoTimestampMs + 1);
  return new Date(ultimoTimestampMs).toISOString();
}

// Se una richiesta non risponde mai, dopo questo tempo i pulsanti si sbloccano
// comunque: durante una partita non si puo' restare bloccati.
const SBLOCCO_AUTOMATICO_MS = 8000;

export const useLiveMatchStore = create<LiveMatchState>((set, get) => {
  let numeroOperazione = 0;

  async function esclusiva(operazione: () => Promise<void>): Promise<void> {
    if (get().occupato) return;
    const mia = ++numeroOperazione;
    set({ occupato: true });
    const sblocco = setTimeout(() => {
      if (numeroOperazione === mia) set({ occupato: false });
    }, SBLOCCO_AUTOMATICO_MS);
    try {
      await operazione();
    } finally {
      clearTimeout(sblocco);
      if (numeroOperazione === mia) set({ occupato: false });
    }
  }

  // Rally in cui va la prossima azione: quello aperto, creato qui se non c'e'.
  async function rallyAperto(): Promise<{ rally: Rally; setCorrente: SetPallavolo }> {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    const esistente = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
    if (esistente) return { rally: esistente, setCorrente: stato.set };
    const nuovo: Rally = {
      id: uuidv4(),
      setId: stato.set.id,
      numero: derivato.rallyApertoNumero,
      squadraAlServizio: derivato.squadraAlServizio,
      esito: null,
      chiusuraManuale: false,
    };
    await salvaRally(nuovo);
    set((s) => ({ rallies: aggiungiUnici(s.rallies, [nuovo]) }));
    return { rally: nuovo, setCorrente: stato.set };
  }

  return {
    set: null,
    rallies: [],
    azioni: [],
    sostituzioni: [],
    timeouts: [],
    correzioniPunteggio: [],
    occupato: false,

    caricaSet: (dati) =>
      set({
        set: dati.set,
        rallies: dati.rallies,
        azioni: dati.azioni,
        sostituzioni: dati.sostituzioni,
        timeouts: dati.timeouts,
        correzioniPunteggio: dati.correzioniPunteggio ?? [],
      }),

    // Aggiorna il record del set solo se e' lo stesso gia' caricato: non
    // ripopola uno store che e' stato svuotato (set chiuso).
    sostituisciSet: (nuovo) => set((s) => (s.set && s.set.id === nuovo.id ? { set: nuovo } : {})),

    resetSet: () =>
      set({ set: null, rallies: [], azioni: [], sostituzioni: [], timeouts: [], correzioniPunteggio: [] }),

    statoDerivato: () => {
      const stato = get();
      if (!stato.set) throw new Error('Nessun set caricato');
      return deriveSetState(
        stato.set,
        stato.rallies,
        raggruppaPerRally(stato.azioni),
        stato.sostituzioni,
        stato.correzioniPunteggio,
      );
    },

    registraAzione: (input) =>
      esclusiva(async () => {
        const { rally, setCorrente } = await rallyAperto();
        const ordine = get().azioni.filter((a) => a.rallyId === rally.id).length + 1;
        const azione: Azione = {
          id: uuidv4(),
          rallyId: rally.id,
          setId: setCorrente.id,
          ordine,
          timestamp: timestampUnico(),
          ...input,
        };
        await salvaAzione(azione);
        set((s) => ({ azioni: aggiungiUnici(s.azioni, [azione]) }));
      }),

    // Per due azioni che devono restare nello stesso rally (es. attacco murato:
    // l'attacco e il tocco muro sono due Azione distinte ma la stessa giocata).
    // Il rally aperto e l'ordine di partenza si calcolano una sola volta, prima
    // di salvare entrambe: se la prima azione chiude gia' il rally (es.
    // attacco:/) rileggere lo stato per la seconda lo troverebbe avanzato al
    // rally successivo. Le due azioni condividono il timestamp (un solo gesto).
    registraDueAzioni: (input1, input2) =>
      esclusiva(async () => {
        const { rally, setCorrente } = await rallyAperto();
        const ordineBase = get().azioni.filter((a) => a.rallyId === rally.id).length;
        const timestamp = timestampUnico();
        const azione1: Azione = {
          id: uuidv4(), rallyId: rally.id, setId: setCorrente.id, ordine: ordineBase + 1, timestamp, ...input1,
        };
        const azione2: Azione = {
          id: uuidv4(), rallyId: rally.id, setId: setCorrente.id, ordine: ordineBase + 2, timestamp, ...input2,
        };
        await salvaAzione(azione1);
        await salvaAzione(azione2);
        set((s) => ({ azioni: aggiungiUnici(s.azioni, [azione1, azione2]) }));
      }),

    // Toglie l'ultima cosa fatta (vedi trovaUltimoAnnullabile): un gesto
    // intero (non meta' di battuta+ricezione), un punto manuale, un cambio,
    // un timeout o una correzione di punteggio.
    annullaUltimaAzione: () =>
      esclusiva(async () => {
        const stato = get();
        if (!stato.set) return;
        const bersaglio = trovaUltimoAnnullabile({
          rallies: stato.rallies,
          azioni: stato.azioni,
          sostituzioni: stato.sostituzioni,
          timeouts: stato.timeouts,
          correzioniPunteggio: stato.correzioniPunteggio,
          rallyApertoNumero: stato.statoDerivato().rallyApertoNumero,
        });
        if (!bersaglio) return;

        switch (bersaglio.tipo) {
          case 'azioni': {
            await eliminaAzioni(bersaglio.azioneIds);
            set((s) => ({ azioni: s.azioni.filter((a) => !bersaglio.azioneIds.includes(a.id)) }));
            const restano = get().azioni.some((a) => a.rallyId === bersaglio.rallyId);
            if (!restano) {
              await eliminaRallySeVuoto(bersaglio.rallyId);
              set((s) => ({ rallies: s.rallies.filter((r) => r.id !== bersaglio.rallyId) }));
            }
            return;
          }
          case 'rallyManuale': {
            if (!bersaglio.haAzioni) {
              await eliminaRallySeVuoto(bersaglio.rallyId);
              set((s) => ({ rallies: s.rallies.filter((r) => r.id !== bersaglio.rallyId) }));
              return;
            }
            const rally = get().rallies.find((r) => r.id === bersaglio.rallyId);
            if (!rally) return;
            const riaperto: Rally = { ...rally, esito: null, chiusuraManuale: false };
            await aggiornaRallyEsito(riaperto);
            set((s) => ({ rallies: s.rallies.map((r) => (r.id === riaperto.id ? riaperto : r)) }));
            return;
          }
          case 'sostituzione':
            await eliminaSostituzione(bersaglio.id);
            set((s) => ({ sostituzioni: s.sostituzioni.filter((x) => x.id !== bersaglio.id) }));
            return;
          case 'timeout':
            await eliminaTimeout(bersaglio.id);
            set((s) => ({ timeouts: s.timeouts.filter((x) => x.id !== bersaglio.id) }));
            return;
          case 'correzionePunteggio':
            await eliminaCorrezionePunteggio(bersaglio.id);
            set((s) => ({ correzioniPunteggio: s.correzioniPunteggio.filter((x) => x.id !== bersaglio.id) }));
            return;
        }
      }),

    chiudiRallyManuale: (esito) =>
      esclusiva(async () => {
        const stato = get();
        if (!stato.set) throw new Error('Nessun set caricato');
        const derivato = stato.statoDerivato();
        const aperto = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
        if (!aperto) {
          const nuovoRally: Rally = {
            id: uuidv4(),
            setId: stato.set.id,
            numero: derivato.rallyApertoNumero,
            squadraAlServizio: derivato.squadraAlServizio,
            esito,
            chiusuraManuale: true,
          };
          await salvaRally(nuovoRally);
          set((s) => ({ rallies: aggiungiUnici(s.rallies, [nuovoRally]) }));
        } else {
          const aggiornato: Rally = { ...aperto, esito, chiusuraManuale: true };
          await aggiornaRallyEsito(aggiornato);
          set((s) => ({ rallies: s.rallies.map((r) => (r.id === aggiornato.id ? aggiornato : r)) }));
        }
      }),

    aggiungiSostituzione: (input) =>
      esclusiva(async () => {
        const stato = get();
        if (!stato.set) throw new Error('Nessun set caricato');
        const derivato = stato.statoDerivato();
        const sostituzione: Sostituzione = {
          id: uuidv4(),
          setId: stato.set.id,
          dopoRallyNumero: derivato.rallyApertoNumero - 1,
          ...input,
        };
        await salvaSostituzione(sostituzione);
        set((s) => ({ sostituzioni: aggiungiUnici(s.sostituzioni, [sostituzione]) }));
      }),

    aggiungiTimeout: (squadra) =>
      esclusiva(async () => {
        const stato = get();
        if (!stato.set) throw new Error('Nessun set caricato');
        const derivato = stato.statoDerivato();
        const timeout: Timeout = {
          id: uuidv4(),
          setId: stato.set.id,
          dopoRallyNumero: derivato.rallyApertoNumero - 1,
          squadra,
        };
        await salvaTimeout(timeout);
        set((s) => ({ timeouts: aggiungiUnici(s.timeouts, [timeout]) }));
      }),

    // Sposta di `passi` la formazione di partenza della squadra: la rotazione
    // attuale e' derivata da quella, quindi gira anche ora (e le sostituzioni,
    // legate al giocatore, restano dove sono). Non cambia punteggio ne' servizio.
    ruotaSquadra: (squadra, passi) =>
      esclusiva(async () => {
        const setCorrente = get().set;
        if (!setCorrente) throw new Error('Nessun set caricato');
        const campo = squadra === 'A' ? 'formazioneInizialeA' : 'formazioneInizialeB';
        const nuova = ruotaFormazione(setCorrente[campo], passi);
        await aggiornaFormazioneIniziale(setCorrente.id, squadra, nuova);
        set((s) => (s.set ? { set: { ...s.set, [campo]: nuova } } : {}));
      }),

    // Porta il punteggio ai valori indicati con una correzione (non un rally):
    // le azioni registrate restano, rotazione e servizio non cambiano.
    correggiPunteggio: (punteggioA, punteggioB) =>
      esclusiva(async () => {
        const stato = get();
        if (!stato.set) throw new Error('Nessun set caricato');
        if (![punteggioA, punteggioB].every((p) => Number.isInteger(p) && p >= 0)) {
          throw new Error('Il punteggio deve essere un numero intero, zero o piu');
        }
        const derivato = stato.statoDerivato();
        const deltaA = punteggioA - derivato.punteggioA;
        const deltaB = punteggioB - derivato.punteggioB;
        if (deltaA === 0 && deltaB === 0) return;
        const correzione: CorrezionePunteggio = {
          id: uuidv4(),
          setId: stato.set.id,
          dopoRallyNumero: derivato.rallyApertoNumero - 1,
          deltaA,
          deltaB,
        };
        await salvaCorrezionePunteggio(correzione);
        set((s) => ({ correzioniPunteggio: aggiungiUnici(s.correzioniPunteggio, [correzione]) }));
      }),

    correggiValutazione: async (azioneId, nuovaValutazione) => {
      const azione = get().azioni.find((a) => a.id === azioneId);
      await aggiornaValutazioneAzione(azioneId, nuovaValutazione);

      // Battuta e ricezione sono salvate come due azioni distinte, ma la
      // valutazione della battuta e' DERIVATA da quella della ricezione
      // (vedi BattutaFlow). La striscia di correzione puo' correggere solo
      // l'ultima azione registrata - cioe' la ricezione - quindi senza questo
      // ri-calcolo la battuta appaiata resterebbe al valore derivato prima
      // della correzione (es. un ace corretto a mano resterebbe a referto come
      // battuta '-').
      let battutaAppaiata: Azione | undefined;
      let valutazioneBattuta: Azione['valutazione'] | undefined;
      if (azione && azione.fondamentale === 'ricezione') {
        battutaAppaiata = get()
          .azioni.filter(
            (a) => a.rallyId === azione.rallyId && a.fondamentale === 'battuta' && a.ordine < azione.ordine,
          )
          .sort((a, b) => a.ordine - b.ordine)
          .pop();
        if (battutaAppaiata) {
          valutazioneBattuta = derivaValutazioneBattutaDaRicezione(nuovaValutazione);
          await aggiornaValutazioneAzione(battutaAppaiata.id, valutazioneBattuta);
        }
      }

      // Il muro non si registra mai a parte: e' sempre derivato dalla
      // valutazione dell'attacco che ha toccato (vedi AttaccoMuroFlow e
      // derivaValutazioneMuroDaAttacco). Se lo scout corregge quell'attacco
      // dopo aver visto come e' proseguito il rally, il muro appaiato (stesso
      // rally, ordine subito successivo) va ricalcolato di conseguenza.
      let muroAppaiato: Azione | undefined;
      let valutazioneMuro: Azione['valutazione'] | undefined;
      if (azione && azione.fondamentale === 'attacco' && azione.toccoMuro) {
        muroAppaiato = get().azioni.find(
          (a) => a.rallyId === azione.rallyId && a.fondamentale === 'muro' && a.ordine === azione.ordine + 1,
        );
        if (muroAppaiato) {
          valutazioneMuro = derivaValutazioneMuroDaAttacco(nuovaValutazione);
          await aggiornaValutazioneAzione(muroAppaiato.id, valutazioneMuro);
        }
      }

      set((s) => ({
        azioni: s.azioni.map((a) => {
          if (a.id === azioneId) return { ...a, valutazione: nuovaValutazione };
          if (battutaAppaiata && a.id === battutaAppaiata.id) {
            return { ...a, valutazione: valutazioneBattuta! };
          }
          if (muroAppaiato && a.id === muroAppaiato.id) {
            return { ...a, valutazione: valutazioneMuro! };
          }
          return a;
        }),
      }));
    },
  };
});
