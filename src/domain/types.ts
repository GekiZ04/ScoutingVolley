export type Squadra = 'A' | 'B';
export type Fondamentale = 'battuta' | 'ricezione' | 'attacco' | 'muro';
export type TipoBattuta = 'flottante' | 'salto_flottante' | 'salto_spin';
export type Valutazione = '#' | '+' | '!' | '-' | '=';
export type Ruolo = 'palleggiatore' | 'opposto' | 'schiacciatore' | 'centrale' | 'libero';

export interface Team {
  id: string;
  nome: string;
  createdAt: string;
}

export interface Player {
  id: string;
  teamId: string;
  numero: number;
  nome: string;
  ruolo: Ruolo;
  attivo: boolean;
}

export interface Match {
  id: string;
  data: string;
  squadraAId: string;
  squadraBId: string;
  squadraRiferimentoId: string | null;
  formatoSet: 3 | 5;
  puntiSet: number;
  puntiSetDecisivo: number;
  stato: 'in_corso' | 'conclusa';
  note?: string;
}

export interface SetPallavolo {
  id: string;
  matchId: string;
  numero: number;
  formazioneInizialeA: string[];
  formazioneInizialeB: string[];
  primaSquadraAlServizio: Squadra;
  stato: 'in_corso' | 'concluso';
  vincitore: Squadra | null;
}

export interface Rally {
  id: string;
  setId: string;
  numero: number;
  squadraAlServizio: Squadra;
  esito: 'punto_A' | 'punto_B' | null;
  chiusuraManuale: boolean;
}

export interface Azione {
  id: string;
  rallyId: string;
  setId: string;
  ordine: number;
  squadra: Squadra;
  giocatoreId: string | null;
  fondamentale: Fondamentale;
  tipoBattuta: TipoBattuta | null;
  valutazione: Valutazione;
  zona: number | null;
  direzione: number | null;
  timestamp: string;
}

export interface Sostituzione {
  id: string;
  setId: string;
  dopoRallyNumero: number;
  squadra: Squadra;
  giocatoreEsceId: string;
  giocatoreEntraId: string;
}

export interface Timeout {
  id: string;
  setId: string;
  dopoRallyNumero: number;
  squadra: Squadra;
}
