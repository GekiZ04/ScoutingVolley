import { calcolaRigaGiocatore, calcolaRigaSquadra } from '@/domain/statisticheComplete';
import { cellaSetGiocatore, puntiVintiPerFonte, statPunti, type CellaSet } from '@/domain/tabellinoExtra';
import { valoriRigaTabellino } from '@/features/export/tabellinoColonne';
import type { RiepilogoPartita } from '@/db/matchSummary';
import type { Azione, Player, Rally, Squadra } from '@/domain/types';

/** Valori delle colonne del tabellino per un giocatore (statistiche + punti). */
export function valoriGiocatoreTabellino(azioni: Azione[], rallies: Rally[], giocatoreId: string) {
  return valoriRigaTabellino(
    calcolaRigaGiocatore(azioni, giocatoreId),
    statPunti(azioni, rallies, (a) => a.giocatoreId === giocatoreId),
  );
}

/** Valori delle colonne del tabellino per il totale di una squadra. */
export function valoriTotaleTabellino(azioni: Azione[], rallies: Rally[], squadra: Squadra) {
  return valoriRigaTabellino(
    calcolaRigaSquadra(azioni, squadra),
    statPunti(azioni, rallies, (a) => a.squadra === squadra),
  );
}

/** Le cinque colonne Set del tabellino (in app, PDF ed Excel). */
export const NUMERI_SET = [1, 2, 3, 4, 5];

/**
 * Dati del tabellino di una squadra oltre alle statistiche: la rosa, chi e'
 * libero, la posizione di partenza di ogni giocatore in ogni set, i punti
 * vinti per fonte (un set per riga piu' il totale) e i set in cui la squadra
 * ha battuto per prima. Usato dalla pagina del tabellino e dagli export.
 */
export function extraTabellinoSquadra(dati: RiepilogoPartita, squadra: Squadra) {
  const { match, giocatori, riepiloghi, tutteLeAzioni, tutteLeRallies, tutteLeSostituzioni } = dati;
  const teamId = squadra === 'A' ? match.squadraAId : match.squadraBId;
  const selezionati = (squadra === 'A' ? match.liberiSelezionatiA : match.liberiSelezionatiB) ?? [];
  const azioniDelSet = (setId: string) => tutteLeAzioni.filter((a) => a.setId === setId);
  // In amichevole la stessa rosa e' su entrambi i lati: ogni lato mostra solo
  // chi ci ha giocato (titolare, entrato, libero scelto o con azioni).
  const amichevole = match.squadraAId === match.squadraBId;
  const giocaDaQuestoLato = (g: Player) =>
    riepiloghi.some(({ set }) => (squadra === 'A' ? set.formazioneInizialeA : set.formazioneInizialeB).includes(g.id)) ||
    tutteLeSostituzioni.some((s) => s.squadra === squadra && s.giocatoreEntraId === g.id) ||
    tutteLeAzioni.some((a) => a.squadra === squadra && a.giocatoreId === g.id) ||
    selezionati.includes(g.id);
  const visti = new Set<string>();
  const roster = giocatori.filter((g) => {
    if (g.teamId !== teamId || visti.has(g.id)) return false;
    visti.add(g.id);
    return !amichevole || giocaDaQuestoLato(g);
  });
  return {
    roster,
    libero: (g: Player) => g.ruolo === 'libero' || selezionati.includes(g.id),
    celleSet: (g: Player): CellaSet[] =>
      riepiloghi.map(({ set }) =>
        cellaSetGiocatore({ set, sostituzioni: tutteLeSostituzioni, azioni: azioniDelSet(set.id), giocatore: g }),
      ),
    puntiVinti: [
      ...riepiloghi.map(({ set }) => ({
        etichetta: `Set ${set.numero}`,
        valori: puntiVintiPerFonte(
          azioniDelSet(set.id),
          tutteLeRallies.filter((r) => r.setId === set.id),
          squadra,
        ),
      })),
      { etichetta: 'Totale', valori: puntiVintiPerFonte(tutteLeAzioni, tutteLeRallies, squadra) },
    ],
    primaBattuta: NUMERI_SET.map((_, i) => riepiloghi[i]?.set.primaSquadraAlServizio === squadra),
  };
}
