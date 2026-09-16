import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { calcolaStatistiche } from '@/domain/stats';
import type { Azione, Fondamentale } from '@/domain/types';

const FONDAMENTALI: Fondamentale[] = ['battuta', 'ricezione', 'attacco', 'muro'];

function escapeCsv(valore: string | number | null): string {
  const testo = String(valore ?? '');
  if (testo.includes(',') || testo.includes('"') || testo.includes('\n')) {
    return `"${testo.replace(/"/g, '""')}"`;
  }
  return testo;
}

export async function generaCsvAzioni(matchId: string): Promise<string> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');
  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];
  const nomeGiocatore = (id: string | null) => {
    if (!id) return '';
    const g = giocatori.find((p) => p.id === id);
    return g ? `#${g.numero} ${g.nome}` : id;
  };

  const intestazione = [
    'data', 'set', 'rally', 'squadra', 'giocatore', 'fondamentale', 'tipoBattuta',
    'valutazione', 'zona', 'direzione', 'timestamp',
  ];
  const righe = [intestazione.join(',')];

  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    const numeroRallyPerRallyId = new Map(dati.rallies.map((r) => [r.id, r.numero]));
    for (const azione of dati.azioni) {
      righe.push(
        [
          escapeCsv(match.data),
          escapeCsv(set.numero),
          escapeCsv(numeroRallyPerRallyId.get(azione.rallyId) ?? ''),
          escapeCsv(azione.squadra),
          escapeCsv(nomeGiocatore(azione.giocatoreId)),
          escapeCsv(azione.fondamentale),
          escapeCsv(azione.tipoBattuta),
          escapeCsv(azione.valutazione),
          escapeCsv(azione.zona),
          escapeCsv(azione.direzione),
          escapeCsv(azione.timestamp),
        ].join(','),
      );
    }
  }
  return righe.join('\n');
}

export async function generaCsvBoxScore(matchId: string): Promise<string> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');
  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];

  const tutteLeAzioni: Azione[] = [];
  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    tutteLeAzioni.push(...dati.azioni);
  }

  const intestazione = ['giocatore', ...FONDAMENTALI.flatMap((f) => [`${f}_tentativi`, `${f}_efficienza`])];
  const righe = [intestazione.join(',')];
  for (const giocatore of giocatori) {
    const cella = [escapeCsv(`#${giocatore.numero} ${giocatore.nome}`)];
    for (const fondamentale of FONDAMENTALI) {
      const stats = calcolaStatistiche(tutteLeAzioni, fondamentale, giocatore.id);
      cella.push(escapeCsv(stats.tentativi), escapeCsv(stats.efficienzaPercento.toFixed(1)));
    }
    righe.push(cella.join(','));
  }
  return righe.join('\n');
}

export function scaricaCsv(nomeFile: string, contenuto: string): void {
  const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(url);
}
