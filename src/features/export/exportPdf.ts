import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { caricaRiepilogoPartita, type RiepilogoPartita } from '@/db/matchSummary';
import { frecceAttacco, frecceBattuta, puntoIncrocioRete, type EsitoAttacco, type FrecciaAttacco } from '@/domain/analysis';
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, RETE_X } from '@/domain/courtPositions';
import type { CellaSet } from '@/domain/tabellinoExtra';
import { extraTabellinoSquadra, NUMERI_SET } from '@/features/tabellino/righeTabellino';
import { GRUPPI_TABELLINO, sezioniTabellino } from './tabellinoColonne';
import type { Azione, Player, Squadra } from '@/domain/types';

const COLORE_ESITO_ATTACCO: Record<EsitoAttacco, [number, number, number]> = {
  punto: [0, 0, 0],
  errore: [239, 68, 68],
  difeso: [37, 99, 235],
};

// Disegna il campo (rapporto 2:1, come il campo reale 18x9m) con una freccia
// partenza->arrivo per ogni attacco, colorata secondo l'esito: nero = punto,
// rosso = errore, blu = difeso dall'avversario (rally continua).
function disegnaCampoConFrecce(
  doc: jsPDF,
  x: number,
  y: number,
  larghezza: number,
  altezza: number,
  frecce: FrecciaAttacco[],
): void {
  const px = (domX: number) => x + (domX / 100) * larghezza;
  const py = (domY: number) => y + (domY / 100) * altezza;

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.3);
  doc.rect(x, y, larghezza, altezza);
  doc.line(px(LINEA_TRE_METRI_A), y, px(LINEA_TRE_METRI_A), y + altezza);
  doc.line(px(LINEA_TRE_METRI_B), y, px(LINEA_TRE_METRI_B), y + altezza);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.6);
  doc.line(px(RETE_X), y, px(RETE_X), y + altezza);

  const lunghezzaFreccia = 2.2;
  const larghezzaFreccia = 1.1;
  for (const freccia of frecce) {
    const [r, g, b] = COLORE_ESITO_ATTACCO[freccia.esito];
    doc.setDrawColor(r, g, b);
    doc.setFillColor(r, g, b);
    doc.setLineWidth(0.25);
    const x1 = px(freccia.origine.x);
    const y1 = py(freccia.origine.y);
    const x2 = px(freccia.destinazione.x);
    const y2 = py(freccia.destinazione.y);

    // Toccata dal muro: linea spezzata origine->rete->destinazione (con un
    // pallino sul punto di tocco) invece che dritta, cosi' si vede la
    // deviazione senza dover registrare un terzo punto a parte.
    if (freccia.toccoMuro) {
      const tocco = puntoIncrocioRete(freccia.origine, freccia.destinazione);
      const xt = px(tocco.x);
      const yt = py(tocco.y);
      doc.line(x1, y1, xt, yt);
      doc.line(xt, yt, x2, y2);
      doc.circle(xt, yt, 0.7, 'F');
    } else {
      doc.line(x1, y1, x2, y2);
    }

    const angolo = Math.atan2(y2 - y1, x2 - x1);
    const baseX = x2 - lunghezzaFreccia * Math.cos(angolo);
    const baseY = y2 - lunghezzaFreccia * Math.sin(angolo);
    const sinistraX = baseX + larghezzaFreccia * Math.cos(angolo + Math.PI / 2);
    const sinistraY = baseY + larghezzaFreccia * Math.sin(angolo + Math.PI / 2);
    const destraX = baseX + larghezzaFreccia * Math.cos(angolo - Math.PI / 2);
    const destraY = baseY + larghezzaFreccia * Math.sin(angolo - Math.PI / 2);
    doc.triangle(x2, y2, sinistraX, sinistraY, destraX, destraY, 'F');
  }
}

function disegnaLegendaFrecce(doc: jsPDF, x: number, y: number, etichettaDifeso: string = 'Difeso'): void {
  doc.setFontSize(9);
  const voci: [EsitoAttacco, string][] = [
    ['punto', 'Punto'],
    ['errore', 'Errore'],
    ['difeso', etichettaDifeso],
  ];
  let cursore = x;
  for (const [esito, etichetta] of voci) {
    const [r, g, b] = COLORE_ESITO_ATTACCO[esito];
    doc.setFillColor(r, g, b);
    doc.circle(cursore, y - 1, 1.2, 'F');
    doc.setTextColor(0, 0, 0);
    doc.text(etichetta, cursore + 3, y);
    cursore += 25;
  }
}

// Griglia con un piccolo diagramma campo per giocatore (2 per riga), per chi
// ha almeno una traiettoria nota — stessa idea dei diagrammi per squadra ma
// a livello di singolo giocatore, elenco unico come in
// disegnaEfficienzaPerGiocatore (non diviso per squadra).
function disegnaGrigliaDirezioniGiocatori(
  doc: jsPDF,
  titolo: string,
  giocatori: Player[],
  azioni: Azione[],
  frecceFn: (azioni: Azione[], squadra?: Squadra, giocatoreId?: string) => FrecciaAttacco[],
  etichettaDifeso: string,
): void {
  const giocatoriConDati = giocatori.filter((g) => frecceFn(azioni, undefined, g.id).length > 0);
  if (giocatoriConDati.length === 0) return;

  doc.addPage('a4', 'portrait');
  let y = 20;
  doc.setFontSize(16);
  doc.text(titolo, 14, y);
  y += 10;

  const larghezza = 85;
  const altezza = 42.5;
  const xColonne = [14, 14 + larghezza + 10];
  let colonna = 0;

  for (const giocatore of giocatoriConDati) {
    if (y + 6 + altezza + 6 > 280) {
      doc.addPage('a4', 'portrait');
      y = 20;
      colonna = 0;
    }
    const x = xColonne[colonna];
    doc.setFontSize(10);
    doc.text(`#${giocatore.numero} ${giocatore.nome}`, x, y);
    disegnaCampoConFrecce(doc, x, y + 3, larghezza, altezza, frecceFn(azioni, undefined, giocatore.id));
    if (colonna === 1) {
      y += altezza + 12;
      colonna = 0;
    } else {
      colonna = 1;
    }
  }
  if (colonna === 1) y += altezza + 12;
  disegnaLegendaFrecce(doc, 14, y + 6, etichettaDifeso);
}

// Tabellino denso stile Click&Scout: un'intestazione a due righe (gruppo di
// fondamentale + sotto-colonne, stessa definizione condivisa con l'Excel) e
// una riga per giocatore, in sezioni: partita intera e poi un blocco per ogni
// set, ognuno chiuso dal totale squadra. A sinistra le colonne Set 1-5 come nel
// tabellino in app: quadratino col numero di posizione (grassetto per il
// palleggiatore), rettangolo vuoto se entrato, cerchio sul numero del set in
// cui la squadra ha battuto per prima; "L" accanto al nome dei liberi. Con ~45
// colonne totali non entra in larghezza nemmeno in orizzontale:
// horizontalPageBreak continua le colonne in eccedenza su pagine successive,
// ripetendo Set/#/Giocatore per riferimento (la riga titolo di sezione occupa
// proprio quelle colonne, cosi' il nome del set si legge su ogni pagina).
// Sotto, la tabella Punti Vinti per set.
function disegnaTabellino(doc: jsPDF, titolo: string, squadra: Squadra, dati: RiepilogoPartita): void {
  doc.addPage('a4', 'landscape');
  doc.setFontSize(16);
  doc.text(titolo, 14, 15);

  const extra = extraTabellinoSquadra(dati, squadra);
  const sets = dati.riepiloghi.map(({ set, punteggioA, punteggioB }) => ({
    id: set.id,
    numero: set.numero,
    punteggioA,
    punteggioB,
  }));
  const colonneSet = NUMERI_SET.length;
  const colonnaGiocatore = colonneSet + 1;

  const rigaGruppi = [
    { content: 'Set', colSpan: colonneSet },
    { content: '#', rowSpan: 2 },
    { content: 'Giocatore', rowSpan: 2 },
    ...GRUPPI_TABELLINO.map((gruppo) => ({ content: gruppo.titolo, colSpan: gruppo.colonne.length })),
  ];
  const rigaSottocolonne = [...NUMERI_SET.map(String), ...GRUPPI_TABELLINO.flatMap((gruppo) => gruppo.colonne)];
  const stileTitolo = { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' } as const;
  const stileTotale = { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: 'bold' } as const;

  const corpo: (string | number | { content: string | number; colSpan?: number; styles?: object })[][] = [];
  // Celle Set di ogni riga del corpo (undefined per titoli e totali), lette in
  // didDrawCell per disegnare quadratini e rettangoli.
  const celleSetCorpo: (CellaSet[] | undefined)[] = [];
  for (const sezione of sezioniTabellino({ giocatori: extra.roster, squadra, azioni: dati.tutteLeAzioni, rallies: dati.tutteLeRallies, sets })) {
    corpo.push([
      { content: sezione.titolo, colSpan: colonnaGiocatore + 1, styles: stileTitolo },
      ...sezione.totale.map(() => ({ content: '', styles: stileTitolo })),
    ]);
    celleSetCorpo.push(undefined);
    for (const riga of sezione.righe) {
      const celle = extra.celleSet(riga.giocatore);
      corpo.push([
        ...NUMERI_SET.map((_, i) => {
          const cella = celle[i];
          return cella?.tipo === 'titolare'
            ? { content: cella.posizione, styles: cella.palleggiatore ? { fontStyle: 'bold' } : {} }
            : '';
        }),
        riga.numero,
        extra.libero(riga.giocatore) ? `${riga.nome}  L` : riga.nome,
        ...riga.valori,
      ]);
      celleSetCorpo.push(celle);
    }
    corpo.push([
      ...Array.from({ length: colonnaGiocatore }, () => ({ content: '', styles: stileTotale })),
      { content: 'Totale squadra', styles: stileTotale },
      ...sezione.totale.map((valore) => ({ content: valore, styles: stileTotale })),
    ]);
    celleSetCorpo.push(undefined);
  }

  autoTable(doc, {
    head: [rigaGruppi, rigaSottocolonne],
    body: corpo,
    startY: 20,
    theme: 'grid',
    styles: { fontSize: 6, cellPadding: 1, halign: 'center', valign: 'middle' },
    headStyles: { fillColor: [30, 58, 95], fontSize: 6 },
    columnStyles: { [colonnaGiocatore]: { halign: 'left', cellWidth: 26 } },
    horizontalPageBreak: true,
    horizontalPageBreakRepeat: Array.from({ length: colonnaGiocatore + 1 }, (_, i) => i),
    didDrawCell: (data) => {
      const indice = data.column.index;
      if (indice >= colonneSet) return;
      const { x, y, width, height } = data.cell;
      const cx = x + width / 2;
      const cy = y + height / 2;
      doc.setLineWidth(0.2);
      if (data.section === 'head' && data.row.index === 1 && extra.primaBattuta[indice]) {
        doc.setDrawColor(255, 255, 255);
        doc.circle(cx, cy, Math.min(width, height) / 2 - 0.4, 'S');
      } else if (data.section === 'body' && celleSetCorpo[data.row.index]?.[indice]) {
        doc.setDrawColor(0, 0, 0);
        doc.rect(cx - 2, cy - 1.5, 4, 3, 'S');
      }
    },
  });

  autoTable(doc, {
    head: [['Punti Vinti', 'Batt', 'Att', 'Mur', 'Er.Av']],
    body: extra.puntiVinti.map(({ etichetta, valori }) => [etichetta, valori.batt, valori.att, valori.mur, valori.erAv]),
    startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
    theme: 'grid',
    tableWidth: 'wrap',
    styles: { fontSize: 7, cellPadding: 1, halign: 'center' },
    headStyles: { fillColor: [30, 58, 95], fontSize: 7 },
    columnStyles: { 0: { halign: 'left' } },
  });
}

export async function generaPdfReport(matchId: string): Promise<Blob> {
  const riepilogo = await caricaRiepilogoPartita(matchId);
  const { match, giocatori, riepiloghi, tutteLeAzioni } = riepilogo;

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

  disegnaTabellino(doc, 'Tabellino — Squadra A', 'A', riepilogo);
  disegnaTabellino(doc, 'Tabellino — Squadra B', 'B', riepilogo);

  const squadre: [Squadra, string][] = [
    ['A', 'Squadra A'],
    ['B', 'Squadra B'],
  ];

  doc.addPage('a4', 'portrait');
  let yFrecce = 20;
  doc.setFontSize(16);
  doc.text('Direzioni attacco', 14, yFrecce);
  yFrecce += 10;
  for (const [squadra, etichetta] of squadre) {
    doc.setFontSize(12);
    doc.text(etichetta, 14, yFrecce);
    yFrecce += 4;
    disegnaCampoConFrecce(doc, 14, yFrecce, 180, 90, frecceAttacco(tutteLeAzioni, squadra));
    disegnaLegendaFrecce(doc, 14, yFrecce + 90 + 6);
    yFrecce += 90 + 14;
  }

  doc.addPage('a4', 'portrait');
  let yFrecceBattuta = 20;
  doc.setFontSize(16);
  doc.text('Direzioni battuta', 14, yFrecceBattuta);
  yFrecceBattuta += 10;
  for (const [squadra, etichetta] of squadre) {
    doc.setFontSize(12);
    doc.text(etichetta, 14, yFrecceBattuta);
    yFrecceBattuta += 4;
    disegnaCampoConFrecce(doc, 14, yFrecceBattuta, 180, 90, frecceBattuta(tutteLeAzioni, squadra));
    disegnaLegendaFrecce(doc, 14, yFrecceBattuta + 90 + 6, 'Ricevuta');
    yFrecceBattuta += 90 + 14;
  }

  disegnaGrigliaDirezioniGiocatori(doc, 'Direzioni attacco per giocatore', giocatori, tutteLeAzioni, frecceAttacco, 'Difeso');
  disegnaGrigliaDirezioniGiocatori(doc, 'Direzioni battuta per giocatore', giocatori, tutteLeAzioni, frecceBattuta, 'Ricevuta');

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
