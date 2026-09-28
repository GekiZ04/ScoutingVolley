import type { Ruolo } from './types';

export interface RigaRosterImportata {
  numero: number;
  nome: string;
  ruolo: Ruolo;
}

export type EsitoImportRoster =
  | { ok: true; giocatori: RigaRosterImportata[] }
  | { ok: false; errori: string[] };

const RUOLI_VALIDI: Ruolo[] = ['palleggiatore', 'opposto', 'schiacciatore', 'centrale', 'libero'];

const INTESTAZIONE_ATTESA = ['numero', 'nome', 'ruolo'];

// Un valore CSV puo' essere tra virgolette (per contenere virgole); qui
// serve solo per un file a 3 colonne semplici, quindi un parser minimo per
// riga basta: divide su virgola e toglie eventuali virgolette esterne.
function analizzaRigaCsv(riga: string): string[] {
  return riga.split(',').map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
}

/**
 * Formato atteso: CSV con intestazione "numero,nome,ruolo", un giocatore per
 * riga. ruolo deve essere uno tra palleggiatore/opposto/schiacciatore/
 * centrale/libero. Valida tutte le righe prima di importare: se anche una
 * sola riga non e' valida non importa nulla, cosi' il roster non resta a
 * meta' (l'utente corregge il file e riprova).
 */
export function analizzaCsvRoster(testoCsv: string): EsitoImportRoster {
  const righe = testoCsv
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (righe.length === 0) {
    return { ok: false, errori: ['Il file è vuoto.'] };
  }

  const intestazione = analizzaRigaCsv(righe[0]).map((v) => v.toLowerCase());
  const corrisponde =
    intestazione.length === INTESTAZIONE_ATTESA.length &&
    INTESTAZIONE_ATTESA.every((atteso, i) => intestazione[i] === atteso);
  if (!corrisponde) {
    return { ok: false, errori: ['La prima riga deve essere l\'intestazione "numero,nome,ruolo".'] };
  }

  const righeDati = righe.slice(1);
  if (righeDati.length === 0) {
    return { ok: false, errori: ['Il file non contiene nessun giocatore sotto l\'intestazione.'] };
  }

  const errori: string[] = [];
  const giocatori: RigaRosterImportata[] = [];

  righeDati.forEach((riga, indice) => {
    const numeroRiga = indice + 2; // +1 intestazione, +1 base 1
    const valori = analizzaRigaCsv(riga);
    if (valori.length !== 3) {
      errori.push(`Riga ${numeroRiga}: attese 3 colonne (numero,nome,ruolo), trovate ${valori.length}.`);
      return;
    }
    const [numeroTesto, nome, ruoloTesto] = valori;

    const numero = Number(numeroTesto);
    if (!Number.isInteger(numero) || numero <= 0) {
      errori.push(`Riga ${numeroRiga}: numero maglia "${numeroTesto}" non valido.`);
    }
    if (!nome) {
      errori.push(`Riga ${numeroRiga}: nome mancante.`);
    }
    const ruolo = ruoloTesto.toLowerCase() as Ruolo;
    if (!RUOLI_VALIDI.includes(ruolo)) {
      errori.push(
        `Riga ${numeroRiga}: ruolo "${ruoloTesto}" non valido (usa: ${RUOLI_VALIDI.join(', ')}).`,
      );
    }

    if (Number.isInteger(numero) && numero > 0 && nome && RUOLI_VALIDI.includes(ruolo)) {
      giocatori.push({ numero, nome, ruolo });
    }
  });

  if (errori.length > 0) return { ok: false, errori };
  return { ok: true, giocatori };
}

export function generaModelloCsvRoster(): string {
  return [
    'numero,nome,ruolo',
    '1,Rossi,palleggiatore',
    '2,Bianchi,opposto',
    '3,Verdi,schiacciatore',
    '5,Gialli,centrale',
    '7,Marroni,libero',
  ].join('\n');
}
