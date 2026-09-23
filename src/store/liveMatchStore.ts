import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Azione, Rally, SetPallavolo, Sostituzione, Timeout, Squadra } from '@/domain/types';
import { deriveSetState, raggruppaPerRally, type SetStatoDerivato } from '@/domain/reducer';
import { derivaValutazioneBattutaDaRicezione } from '@/domain/valutazioneAutomatica';
import {
  salvaRally,
  aggiornaRallyEsito,
  salvaAzione,
  aggiornaValutazioneAzione,
  eliminaAzione,
  eliminaRallySeVuoto,
  salvaSostituzione,
  salvaTimeout,
} from '@/db/scouting';

interface DatiSetIniziali {
  set: SetPallavolo;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
}

interface LiveMatchState {
  set: SetPallavolo | null;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
  caricaSet: (dati: DatiSetIniziali) => void;
  resetSet: () => void;
  statoDerivato: () => SetStatoDerivato;
  registraAzione: (input: Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>) => Promise<void>;
  registraDueAzioni: (
    input1: Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>,
    input2: Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>,
  ) => Promise<void>;
  annullaUltimaAzione: () => Promise<void>;
  chiudiRallyManuale: (esito: 'punto_A' | 'punto_B') => Promise<void>;
  aggiungiSostituzione: (input: Omit<Sostituzione, 'id' | 'setId' | 'dopoRallyNumero'>) => Promise<void>;
  aggiungiTimeout: (squadra: Squadra) => Promise<void>;
  correggiValutazione: (azioneId: string, nuovaValutazione: Azione['valutazione']) => Promise<void>;
}

export const useLiveMatchStore = create<LiveMatchState>((set, get) => ({
  set: null,
  rallies: [],
  azioni: [],
  sostituzioni: [],
  timeouts: [],

  caricaSet: (dati) =>
    set({
      set: dati.set,
      rallies: dati.rallies,
      azioni: dati.azioni,
      sostituzioni: dati.sostituzioni,
      timeouts: dati.timeouts,
    }),

  resetSet: () => set({ set: null, rallies: [], azioni: [], sostituzioni: [], timeouts: [] }),

  statoDerivato: () => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    return deriveSetState(stato.set, stato.rallies, raggruppaPerRally(stato.azioni), stato.sostituzioni);
  },

  registraAzione: async (input) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    let rallyAperto = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
    if (!rallyAperto) {
      rallyAperto = {
        id: uuidv4(),
        setId: stato.set.id,
        numero: derivato.rallyApertoNumero,
        squadraAlServizio: derivato.squadraAlServizio,
        esito: null,
        chiusuraManuale: false,
      };
      await salvaRally(rallyAperto);
      set((s) => ({ rallies: [...s.rallies, rallyAperto!] }));
    }
    const ordine = get().azioni.filter((a) => a.rallyId === rallyAperto!.id).length + 1;
    const azione: Azione = {
      id: uuidv4(),
      rallyId: rallyAperto.id,
      setId: stato.set.id,
      ordine,
      timestamp: new Date().toISOString(),
      ...input,
    };
    await salvaAzione(azione);
    set((s) => ({ azioni: [...s.azioni, azione] }));
  },

  // Per due azioni che devono restare nello stesso rally (es. attacco murato:
  // l'attacco e il tocco muro sono due Azione distinte ma la stessa giocata).
  // registraAzione() da sola non basta: ricalcola il rally aperto leggendo lo
  // stato corrente ad ogni chiamata, quindi se la prima azione chiude gia' il
  // rally (es. attacco:/) la seconda chiamata lo troverebbe gia' avanzato al
  // rally successivo. Qui il rally aperto e l'ordine di partenza si calcolano
  // una sola volta, prima di salvare entrambe le azioni.
  registraDueAzioni: async (input1, input2) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    let rallyAperto = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
    if (!rallyAperto) {
      rallyAperto = {
        id: uuidv4(),
        setId: stato.set.id,
        numero: derivato.rallyApertoNumero,
        squadraAlServizio: derivato.squadraAlServizio,
        esito: null,
        chiusuraManuale: false,
      };
      await salvaRally(rallyAperto);
      set((s) => ({ rallies: [...s.rallies, rallyAperto!] }));
    }
    const ordineBase = get().azioni.filter((a) => a.rallyId === rallyAperto!.id).length;
    const timestamp = new Date().toISOString();
    const azione1: Azione = {
      id: uuidv4(), rallyId: rallyAperto.id, setId: stato.set.id, ordine: ordineBase + 1, timestamp, ...input1,
    };
    const azione2: Azione = {
      id: uuidv4(), rallyId: rallyAperto.id, setId: stato.set.id, ordine: ordineBase + 2, timestamp, ...input2,
    };
    await salvaAzione(azione1);
    await salvaAzione(azione2);
    set((s) => ({ azioni: [...s.azioni, azione1, azione2] }));
  },

  annullaUltimaAzione: async () => {
    const azioniCorrenti = get().azioni;
    const ultima = azioniCorrenti[azioniCorrenti.length - 1];
    if (!ultima) return;
    await eliminaAzione(ultima.id);
    set((s) => ({ azioni: s.azioni.filter((a) => a.id !== ultima.id) }));
    const azioniRimasteRally = get().azioni.filter((a) => a.rallyId === ultima.rallyId);
    if (azioniRimasteRally.length === 0) {
      await eliminaRallySeVuoto(ultima.rallyId);
      set((s) => ({ rallies: s.rallies.filter((r) => r.id !== ultima.rallyId) }));
    }
  },

  chiudiRallyManuale: async (esito) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    const rallyAperto = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
    if (!rallyAperto) {
      const nuovoRally: Rally = {
        id: uuidv4(),
        setId: stato.set.id,
        numero: derivato.rallyApertoNumero,
        squadraAlServizio: derivato.squadraAlServizio,
        esito,
        chiusuraManuale: true,
      };
      await salvaRally(nuovoRally);
      set((s) => ({ rallies: [...s.rallies, nuovoRally] }));
    } else {
      const aggiornato: Rally = { ...rallyAperto, esito, chiusuraManuale: true };
      await aggiornaRallyEsito(aggiornato);
      set((s) => ({ rallies: s.rallies.map((r) => (r.id === aggiornato.id ? aggiornato : r)) }));
    }
  },

  aggiungiSostituzione: async (input) => {
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
    set((s) => ({ sostituzioni: [...s.sostituzioni, sostituzione] }));
  },

  aggiungiTimeout: async (squadra) => {
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
    set((s) => ({ timeouts: [...s.timeouts, timeout] }));
  },

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

    set((s) => ({
      azioni: s.azioni.map((a) => {
        if (a.id === azioneId) return { ...a, valutazione: nuovaValutazione };
        if (battutaAppaiata && a.id === battutaAppaiata.id) {
          return { ...a, valutazione: valutazioneBattuta! };
        }
        return a;
      }),
    }));
  },
}));
