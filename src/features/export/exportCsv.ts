import { caricaRiepilogoPartita } from '@/db/matchSummary';
import { calcolaStatistiche } from '@/domain/stats';
import type { Fondamentale } from '@/domain/types';

const FONDAMENTALI: Fondamentale[] = ['battuta', 'ricezione', 'attacco', 'muro'];

function escapeCsv(valore: string | number | null): string {
  const testo = String(valore ?? '');
  if (testo.includes(',') || testo.includes('"') || testo.includes('\n')) {
    return `"${testo.replace(/"/g, '""')}"`;
  }
  return testo;
}

export async function generaCsvAzioni(matchId: string): Promise<string> {
  const { match, giocatori, riepiloghi, tutteLeAzioni, tutteLeRallies } = await caricaRiepilogoPartita(matchId);
  const nomeGiocatore = (id: string | null) => {
    if (!id) return '';
    const g = giocatori.find((p) => p.id === id);
    return g ? `#${g.numero} ${g.nome}` : id;
  };
  const numeroSetPerSetId = new Map(riepiloghi.map(({ set }) => [set.id, set.numero]));
  const numeroRallyPerRallyId = new Map(tutteLeRallies.map((r) => [r.id, r.numero]));

  const intestazione = [
    'data', 'set', 'rally', 'squadra', 'giocatore', 'fondamentale', 'tipoBattuta',
    'valutazione', 'origine_x', 'origine_y', 'destinazione_x', 'destinazione_y', 'toccoMuro', 'timestamp',
  ];
  const righe = [intestazione.join(',')];

  const coordX = (p: { x: number; y: number } | null): number | null => (p ? Number(p.x.toFixed(1)) : null);
  const coordY = (p: { x: number; y: number } | null): number | null => (p ? Number(p.y.toFixed(1)) : null);

  for (const azione of tutteLeAzioni) {
    righe.push(
      [
        escapeCsv(match.data),
        escapeCsv(numeroSetPerSetId.get(azione.setId) ?? ''),
        escapeCsv(numeroRallyPerRallyId.get(azione.rallyId) ?? ''),
        escapeCsv(azione.squadra),
        escapeCsv(nomeGiocatore(azione.giocatoreId)),
        escapeCsv(azione.fondamentale),
        escapeCsv(azione.tipoBattuta),
        escapeCsv(azione.valutazione),
        escapeCsv(coordX(azione.origine)),
        escapeCsv(coordY(azione.origine)),
        escapeCsv(coordX(azione.destinazione)),
        escapeCsv(coordY(azione.destinazione)),
        escapeCsv(azione.toccoMuro ? 'si' : 'no'),
        escapeCsv(azione.timestamp),
      ].join(','),
    );
  }
  return righe.join('\n');
}

export async function generaCsvBoxScore(matchId: string): Promise<string> {
  const { giocatori, tutteLeAzioni } = await caricaRiepilogoPartita(matchId);

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

const BOM_UTF8 = '﻿';

export function scaricaCsv(nomeFile: string, contenuto: string): void {
  const blob = new Blob([BOM_UTF8 + contenuto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
