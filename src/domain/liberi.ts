import type { Player } from './types';

// Una squadra puo' avere piu' di 2 giocatori con ruolo libero in rosa, ma il
// regolamento ne ammette al massimo 2 in distinta per partita. Se
// liberiSelezionati e' null, il vincolo non e' ancora stato applicato (la
// squadra ha al massimo 2 liberi in rosa, quindi non serve scegliere).
export function giocatoreEleggibileLibero(giocatore: Player, liberiSelezionati: string[] | null): boolean {
  if (giocatore.ruolo !== 'libero') return true;
  if (liberiSelezionati === null) return true;
  return liberiSelezionati.includes(giocatore.id);
}

export function servonoLiberiSelezionati(giocatori: Player[]): boolean {
  return giocatori.filter((g) => g.ruolo === 'libero').length > 2;
}
