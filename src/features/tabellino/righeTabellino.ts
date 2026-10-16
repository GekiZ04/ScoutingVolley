import { calcolaRigaGiocatore, calcolaRigaSquadra } from '@/domain/statisticheComplete';
import { statPunti } from '@/domain/tabellinoExtra';
import { valoriRigaTabellino } from '@/features/export/tabellinoColonne';
import type { Azione, Rally, Squadra } from '@/domain/types';

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
