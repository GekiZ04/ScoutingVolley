import { jsPDF } from 'jspdf';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { deriveSetState } from '@/domain/reducer';
import { calcolaStatistiche } from '@/domain/stats';
import type { Azione, SetPallavolo } from '@/domain/types';

export async function generaPdfReport(matchId: string): Promise<Blob> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');
  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];

  const riepiloghi: { set: SetPallavolo; punteggioA: number; punteggioB: number }[] = [];
  const tutteLeAzioni: Azione[] = [];
  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    const azioniPerRally = new Map<string, Azione[]>();
    for (const azione of dati.azioni) {
      const lista = azioniPerRally.get(azione.rallyId) ?? [];
      lista.push(azione);
      azioniPerRally.set(azione.rallyId, lista);
    }
    const stato = deriveSetState(set, dati.rallies, azioniPerRally, dati.sostituzioni);
    riepiloghi.push({ set, punteggioA: stato.punteggioA, punteggioB: stato.punteggioB });
    tutteLeAzioni.push(...dati.azioni);
  }

  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(`Report partita — ${match.data}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  for (const { set, punteggioA, punteggioB } of riepiloghi) {
    doc.text(`Set ${set.numero}: ${punteggioA} - ${punteggioB}`, 14, y);
    y += 7;
  }

  y += 5;
  doc.setFontSize(14);
  doc.text('Efficienza attacco per giocatore', 14, y);
  y += 8;

  doc.setFontSize(10);
  const larghezzaBarraMax = 100;
  for (const giocatore of giocatori) {
    const stats = calcolaStatistiche(tutteLeAzioni, 'attacco', giocatore.id);
    if (stats.tentativi === 0) continue;
    doc.text(`#${giocatore.numero} ${giocatore.nome} (${stats.efficienzaPercento.toFixed(0)}%)`, 14, y);
    doc.rect(90, y - 4, larghezzaBarraMax, 4);
    const larghezzaBarra = Math.max(0, (Math.max(0, stats.efficienzaPercento) / 100) * larghezzaBarraMax);
    if (larghezzaBarra > 0) {
      doc.setFillColor(37, 99, 235);
      doc.rect(90, y - 4, larghezzaBarra, 4, 'F');
    }
    y += 8;
  }

  return doc.output('blob');
}

export function scaricaPdf(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(url);
}
