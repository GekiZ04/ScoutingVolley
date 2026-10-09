import {
  calcolaRigaGiocatore,
  calcolaRigaSquadra,
  type RigaStatisticheGiocatore,
} from '@/domain/statisticheComplete';
import type { Azione, Player, Squadra } from '@/domain/types';

// Ogni voce e' un gruppo di colonne (un fondamentale) con le sue sotto-
// colonne: la prima riga di intestazione unisce le celle del gruppo col nome
// del fondamentale, la seconda mostra le sotto-colonne — stesso schema nel
// tabellino Excel e in quello PDF, come nei referti Click&Scout allegati
// dall'utente.
export const GRUPPI_TABELLINO: { titolo: string; colonne: string[] }[] = [
  { titolo: 'Battuta', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Direzioni battuta', colonne: ['Par%', 'Diag%', 'Centro%'] },
  { titolo: 'Ricezione', colonne: ['Tot', 'Err', 'Pos%', 'Prf%'] },
  { titolo: 'Attacco', colonne: ['Tot', 'Err', 'Mur', 'Pt', 'Pt%', 'Eff%'] },
  { titolo: 'Attacco dopo Ricezione POS', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Attacco dopo Ricezione NEG', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Contrattacco', colonne: ['Tot', 'Err', 'Mur', 'Pt', 'Pt%', 'Eff%'] },
  { titolo: 'Muro', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Direzioni attacco', colonne: ['Par%', 'Diag%', 'Centro%'] },
];

export function valoriRigaTabellino(riga: RigaStatisticheGiocatore): (number | string)[] {
  const arrotonda = (n: number) => Math.round(n * 10) / 10;
  return [
    riga.battuta.tot, riga.battuta.err, riga.battuta.pt, arrotonda(riga.battuta.ptPercento),
    arrotonda(riga.direzioniBattuta.parallelaPercento), arrotonda(riga.direzioniBattuta.diagonalePercento),
    arrotonda(riga.direzioniBattuta.centroPercento),
    riga.ricezione.tot, riga.ricezione.err, arrotonda(riga.ricezione.posPercento), arrotonda(riga.ricezione.prfPercento),
    riga.attacco.tot, riga.attacco.err, riga.attacco.mur, riga.attacco.pt,
    arrotonda(riga.attacco.ptPercento), arrotonda(riga.attacco.efficienzaPercento),
    riga.attaccoDopoRicezionePositiva.tot, riga.attaccoDopoRicezionePositiva.err,
    riga.attaccoDopoRicezionePositiva.pt, arrotonda(riga.attaccoDopoRicezionePositiva.ptPercento),
    riga.attaccoDopoRicezioneNegativa.tot, riga.attaccoDopoRicezioneNegativa.err,
    riga.attaccoDopoRicezioneNegativa.pt, arrotonda(riga.attaccoDopoRicezioneNegativa.ptPercento),
    riga.contrattacco.tot, riga.contrattacco.err, riga.contrattacco.mur, riga.contrattacco.pt,
    arrotonda(riga.contrattacco.ptPercento), arrotonda(riga.contrattacco.efficienzaPercento),
    riga.muro.tot, riga.muro.err, riga.muro.pt, arrotonda(riga.muro.ptPercento),
    arrotonda(riga.direzioniAttacco.parallelaPercento), arrotonda(riga.direzioniAttacco.diagonalePercento),
    arrotonda(riga.direzioniAttacco.centroPercento),
  ];
}

export interface SezioneTabellino {
  titolo: string;
  righe: { numero: number; nome: string; valori: (number | string)[] }[];
  totale: (number | string)[];
}

/**
 * Il tabellino di una squadra diviso in sezioni: prima la partita intera (tutta
 * la rosa), poi un blocco per ogni set con il suo punteggio, le righe di chi ha
 * giocato azioni in quel set e il totale squadra di quel set.
 */
export function sezioniTabellino(params: {
  giocatori: Player[];
  squadra: Squadra;
  azioni: Azione[];
  sets: { id: string; numero: number; punteggioA: number; punteggioB: number }[];
}): SezioneTabellino[] {
  const { giocatori, squadra, azioni, sets } = params;

  const costruisci = (titolo: string, azioniSezione: Azione[], soloAttivi: boolean): SezioneTabellino => {
    const coinvolti = soloAttivi
      ? giocatori.filter((g) => azioniSezione.some((a) => a.giocatoreId === g.id))
      : giocatori;
    return {
      titolo,
      righe: coinvolti.map((g) => ({
        numero: g.numero,
        nome: g.nome,
        valori: valoriRigaTabellino(calcolaRigaGiocatore(azioniSezione, g.id)),
      })),
      totale: valoriRigaTabellino(calcolaRigaSquadra(azioniSezione, squadra)),
    };
  };

  return [
    costruisci('PARTITA INTERA', azioni, false),
    ...sets.map((set) =>
      costruisci(
        `SET ${set.numero} (${set.punteggioA}-${set.punteggioB})`,
        azioni.filter((a) => a.setId === set.id),
        true,
      ),
    ),
  ];
}
