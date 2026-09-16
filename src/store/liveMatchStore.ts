import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Azione, Rally, SetPallavolo, Sostituzione, Timeout, Squadra } from '@/domain/types';
import { deriveSetState, type SetStatoDerivato } from '@/domain/reducer';
import {
  salvaRally,
  aggiornaRallyEsito,
  salvaAzione,
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
  statoDerivato: () => SetStatoDerivato;
  registraAzione: (input: Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>) => Promise<void>;
  annullaUltimaAzione: () => Promise<void>;
  chiudiRallyManuale: (esito: 'punto_A' | 'punto_B') => Promise<void>;
  aggiungiSostituzione: (input: Omit<Sostituzione, 'id' | 'setId' | 'dopoRallyNumero'>) => Promise<void>;
  aggiungiTimeout: (squadra: Squadra) => Promise<void>;
}

function raggruppaPerRally(azioni: Azione[]): Map<string, Azione[]> {
  const mappa = new Map<string, Azione[]>();
  for (const azione of azioni) {
    const lista = mappa.get(azione.rallyId) ?? [];
    lista.push(azione);
    mappa.set(azione.rallyId, lista);
  }
  return mappa;
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
}));
