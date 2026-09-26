import type { Giro, Player } from './types';

type RuoloInGiro = 'palleggiatore' | 'schiacciatore' | 'centrale' | 'opposto';

// Sequenza fissa dei ruoli intorno al giro di rotazione, a partire dal
// palleggiatore (offset 0) in direzione di rotazione crescente (stesso verso
// di ruotaPosizioni). E' fissa per tutto il set: cambia solo la zona in cui
// si trova ciascun ruolo, non l'ordine relativo tra i ruoli.
const SEQUENZA_GIRO: Record<Giro, RuoloInGiro[]> = {
  'schiacciatore-centrale': ['palleggiatore', 'schiacciatore', 'centrale', 'opposto', 'schiacciatore', 'centrale'],
  'centrale-schiacciatore': ['palleggiatore', 'centrale', 'schiacciatore', 'opposto', 'centrale', 'schiacciatore'],
};

/**
 * Indici (0..5, zona = indice+1) dei due centrali nella rotazione corrente,
 * dedotti da palleggiatore+giro invece che dal campo Player.ruolo: cosi' il
 * calcolo resta corretto anche se i ruoli in rosa non sono taggati con
 * precisione. Ritorna un array vuoto se il palleggiatore non e' in rotazione.
 */
export function indiciCentrali(rotazione: string[], palleggiatoreId: string, giro: Giro): number[] {
  const indicePalleggiatore = rotazione.indexOf(palleggiatoreId);
  if (indicePalleggiatore === -1) return [];
  const sequenza = SEQUENZA_GIRO[giro];
  const indici: number[] = [];
  for (let offset = 0; offset < 6; offset += 1) {
    if (sequenza[offset] === 'centrale') indici.push((indicePalleggiatore + offset) % 6);
  }
  return indici;
}

/**
 * Sceglie quale libero usare per il cambio automatico: il primo tra quelli
 * scelti per la partita (quando la squadra ne ha piu' di 2 in rosa), oppure
 * l'unico libero in rosa se non serve scelta. Con 0 liberi disponibili (o
 * piu' di uno senza una scelta esplicita) ritorna null: il cambio automatico
 * resta disattivato, non essendoci un candidato univoco.
 */
export function liberoDaUsarePerCambioAutomatico(
  liberiSelezionati: string[] | null,
  rosterAttivo: Player[],
): string | null {
  if (liberiSelezionati && liberiSelezionati.length > 0) return liberiSelezionati[0];
  const liberiRoster = rosterAttivo.filter((g) => g.ruolo === 'libero');
  return liberiRoster.length === 1 ? liberiRoster[0].id : null;
}

/**
 * Rotazione "effettiva" per la visualizzazione live: il centrale che si
 * trova in seconda linea lontano dalla zona di battuta (zona 5 o 6) viene
 * mostrato come il libero al suo posto. Mai in zona 1: li' il centrale deve
 * poter battere, cosa che il libero non puo' fare (fallo regolamentare), e
 * mai a rete (zone 2/3/4), dove il centrale gioca normalmente. Non modifica
 * la rotazione reale: serve solo a decidere chi mostrare/selezionare sul
 * campo durante lo scouting live (marker, tap, sostituzioni disponibili).
 */
export function rotazioneConCambioAutomatico(
  rotazione: string[],
  palleggiatoreId: string | null,
  giro: Giro | null,
  liberoId: string | null,
): string[] {
  if (!palleggiatoreId || !giro || !liberoId) return rotazione;
  const centrali = indiciCentrali(rotazione, palleggiatoreId, giro);
  return rotazione.map((giocatoreId, indice) => {
    const zona = indice + 1;
    return centrali.includes(indice) && (zona === 5 || zona === 6) ? liberoId : giocatoreId;
  });
}
