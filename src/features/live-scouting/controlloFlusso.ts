// Collega il pulsante "Annulla" della schermata all'azione in corso:
// indietro() toglie l'ultimo tocco (torna al passo precedente) e restituisce
// false se non c'e' ancora nessun tocco da togliere.
export interface ControlloFlusso {
  indietro: () => boolean;
}
