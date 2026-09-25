import { jsPDF } from 'jspdf';
import { caricaRiepilogoPartita } from '@/db/matchSummary';
import { calcolaStatistiche, type FondamentaleStat } from '@/domain/stats';
import type { Azione, Player } from '@/domain/types';

function disegnaEfficienzaPerGiocatore(
  doc: jsPDF,
  titolo: string,
  yIniziale: number,
  giocatori: Player[],
  azioni: Azione[],
  fondamentale: FondamentaleStat,
): number {
  let y = yIniziale;
  doc.setFontSize(14);
  doc.text(titolo, 14, y);
  y += 8;

  doc.setFontSize(10);
  const larghezzaBarraMax = 100;
  for (const giocatore of giocatori) {
    const stats = calcolaStatistiche(azioni, fondamentale, giocatore.id);
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
  return y;
}

export async function generaPdfReport(matchId: string): Promise<Blob> {
  const { match, giocatori, riepiloghi, tutteLeAzioni } = await caricaRiepilogoPartita(matchId);

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

  y = disegnaEfficienzaPerGiocatore(doc, 'Efficienza attacco per giocatore', y, giocatori, tutteLeAzioni, 'attacco');
  y += 5;
  disegnaEfficienzaPerGiocatore(doc, 'Efficienza contrattacco per giocatore', y, giocatori, tutteLeAzioni, 'contrattacco');

  return doc.output('blob');
}

export function scaricaPdf(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
