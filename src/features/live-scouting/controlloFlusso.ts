import { useEffect } from 'react';
import type { Player } from '@/domain/types';

// Collega il pulsante "Annulla" della schermata all'azione in corso:
// indietro() toglie l'ultimo tocco (torna al passo precedente) e restituisce
// false se non c'e' ancora nessun tocco da togliere.
export interface ControlloFlusso {
  indietro: () => boolean;
}

// Descrive alla schermata il gesto in corso con i suoi tocchi non ancora
// salvati (null = nessun tocco): finche' c'e', "Annulla" toglie l'ultimo di
// quei tocchi e accanto al tasto va mostrato lui, non un codice salvato.
export type SegnalaGestoInCorso = (descrizione: string | null) => void;

/** '#07' per il giocatore con numero 7 tra quelli in campo, '#?' se assente. */
export function magliaDi(giocatori: Player[], id: string): string {
  const numero = giocatori.find((g) => g.id === id)?.numero;
  return numero === undefined ? '#?' : `#${String(numero).padStart(2, '0')}`;
}

export function useSegnalaGestoInCorso(descrizione: string | null, segnala: SegnalaGestoInCorso | undefined) {
  useEffect(() => {
    segnala?.(descrizione);
  }, [descrizione, segnala]);
  // Smontato il flusso (azione salvata, passo diverso) non c'e' piu' niente in corso.
  useEffect(() => () => segnala?.(null), [segnala]);
}
