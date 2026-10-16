import { cronologiaSet } from './cronologiaSet';
import type { Azione, Rally, SetPallavolo, Sostituzione, Squadra, TipoBattuta } from './types';

export interface CodiceStriscia {
  chiave: string; // id stabile per React
  testo: string; // es. 'a15SQ-'
  squadra: Squadra | null; // null per fine set
  azioneIds: string[]; // [] per punto/fine set
  gesto: string; // azioni dello stesso gesto (stesso timestamp) condividono il valore
}

const LETTERA = { battuta: 'S', ricezione: 'R', attacco: 'A', muro: 'B' } as const;

const TIPO: Record<TipoBattuta, string> = { salto_spin: 'Q', salto_flottante: 'M', flottante: 'H' };

function prefisso(squadra: Squadra): string {
  return squadra === 'A' ? '*' : 'a';
}

function due(n: number): string {
  return String(n).padStart(2, '0');
}

function codice(azione: Azione, numeroGiocatore: number | null, tipo: string): string {
  const numero = numeroGiocatore === null ? '$$' : due(numeroGiocatore);
  return `${prefisso(azione.squadra)}${numero}${LETTERA[azione.fondamentale]}${tipo}${azione.valutazione}`;
}

function tipoDa(tipoBattuta: TipoBattuta | null): string {
  return tipoBattuta ? TIPO[tipoBattuta] : 'H';
}

export function codiceAzione(azione: Azione, numeroGiocatore: number | null): string {
  const tipo = azione.fondamentale === 'battuta' || azione.fondamentale === 'ricezione' ? tipoDa(azione.tipoBattuta) : 'H';
  return codice(azione, numeroGiocatore, tipo);
}

export function codiciSet(params: {
  set: SetPallavolo;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  numeroDi: (giocatoreId: string) => number | null;
}): CodiceStriscia[] {
  const { set, rallies, azioni, sostituzioni, numeroDi } = params;
  const info = cronologiaSet(set, rallies, azioni, sostituzioni);
  const risultato: CodiceStriscia[] = [];

  for (const r of info) {
    const delRally = azioni.filter((a) => a.rallyId === r.rallyId).sort((a, b) => a.ordine - b.ordine);
    const tipoBattuta = delRally.find((a) => a.fondamentale === 'battuta')?.tipoBattuta ?? null;
    for (const a of delRally) {
      const numero = a.giocatoreId === null ? null : numeroDi(a.giocatoreId);
      const tipo =
        a.fondamentale === 'battuta' ? tipoDa(a.tipoBattuta)
        : a.fondamentale === 'ricezione' ? tipoDa(tipoBattuta)
        : 'H';
      risultato.push({
        chiave: a.id,
        testo: codice(a, numero, tipo),
        squadra: a.squadra,
        azioneIds: [a.id],
        gesto: a.timestamp,
      });
    }
    if (r.vincitore) {
      risultato.push({
        chiave: `punto-${r.rallyId}`,
        testo: `${prefisso(r.vincitore)}p${due(r.punteggioA)}:${due(r.punteggioB)}`,
        squadra: r.vincitore,
        azioneIds: [],
        gesto: `punto-${r.rallyId}`,
      });
    }
  }

  if (set.stato === 'concluso') {
    risultato.push({ chiave: 'fine-set', testo: `**${set.numero}Set`, squadra: null, azioneIds: [], gesto: 'fine-set' });
  }
  return risultato;
}
