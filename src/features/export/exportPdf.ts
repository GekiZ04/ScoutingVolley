import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { caricaRiepilogoPartita, type RiepilogoPartita } from '@/db/matchSummary';
import { frecceAttacco, frecceBattuta, puntoIncrocioRete, type EsitoAttacco, type FrecciaAttacco } from '@/domain/analysis';
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, RETE_X } from '@/domain/courtPositions';
import { COLONNE_PUNTI_VINTI, durataSet, type CellaSet } from '@/domain/tabellinoExtra';
import { extraTabellinoSquadra, NUMERI_SET } from '@/features/tabellino/righeTabellino';
import { GRUPPI_TABELLINO, INIZI_GRUPPO, sezioniTabellino } from './tabellinoColonne';
import type { Azione, Player, Squadra, Team } from '@/domain/types';

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

type Rgb = [number, number, number];
const BLU_SCURO: Rgb = [30, 58, 95];
const ARDESIA: Rgb = [51, 65, 85];
const GRIGIO_RIGHE: Rgb = [203, 213, 225];
const FONDO_TOTALE: Rgb = [226, 232, 240];
const FONDO_ALTERNO: Rgb = [246, 248, 251];
const GRIGIO_ZERO: Rgb = [170, 178, 189];
const TESTO: Rgb = [15, 23, 42];
const SPESSORE_SEPARATORE = 0.7;
const MARGINE = 7;

// Etichette accorciate solo nel PDF, dove ogni colonna ha una larghezza fissa.
const SOTTOCOLONNA_BREVE: Record<string, string> = { 'Centro%': 'Cen%' };

type TipoRiga = 'titolo' | 'giocatore' | 'giocatoreAlterno' | 'totale';

// Tabellino denso stile Click&Scout su una sola pagina in larghezza (A4
// orizzontale, colonne a larghezza fissa): intestazione a due righe (gruppo di
// fondamentale + sotto-colonne, stessa definizione dell'Excel) e una riga per
// giocatore, in sezioni: partita intera e poi un blocco per ogni set, ognuno
// chiuso dal totale squadra. A sinistra le colonne Set 1-5 come nel tabellino
// in app: quadratino col numero di posizione (grassetto per il palleggiatore),
// rettangolo vuoto se entrato, cerchio sul numero del set in cui la squadra ha
// battuto per prima; "L" accanto al nome dei liberi. Linee spesse separano i
// fondamentali tra loro e le sezioni; gli zeri sono grigio chiaro cosi' i
// numeri che contano saltano all'occhio. Sotto, la tabella Punti Vinti per set.
function disegnaTabellino(doc: jsPDF, titolo: string, squadra: Squadra, dati: RiepilogoPartita): void {
  doc.addPage('a4', 'landscape');
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...TESTO);
  doc.text(titolo, MARGINE, 12);
  doc.setFont('helvetica', 'normal');

  const extra = extraTabellinoSquadra(dati, squadra);
  const sets = dati.riepiloghi.map(({ set, punteggioA, punteggioB }) => ({
    id: set.id,
    numero: set.numero,
    punteggioA,
    punteggioB,
  }));
  const colonneSet = NUMERI_SET.length;
  const colonnaGiocatore = colonneSet + 1;
  const primaColonnaValori = colonneSet + 2;
  const sottocolonne = GRUPPI_TABELLINO.flatMap((gruppo) => gruppo.colonne);

  // Separatore spesso a sinistra di: colonna #, primo valore, inizio di ogni gruppo.
  const separatori = new Set([colonneSet, ...[...INIZI_GRUPPO].map((i) => primaColonnaValori + i)]);

  const larghezze: Record<number, { cellWidth: number; halign?: 'left' }> = {};
  NUMERI_SET.forEach((_, i) => (larghezze[i] = { cellWidth: 5 }));
  larghezze[colonneSet] = { cellWidth: 5.5 };
  larghezze[colonnaGiocatore] = { cellWidth: 28, halign: 'left' };
  sottocolonne.forEach((nome, i) => (larghezze[primaColonnaValori + i] = { cellWidth: nome.endsWith('%') ? 7 : 5.3 }));

  const rigaGruppi = [
    { content: 'Set', colSpan: colonneSet },
    { content: '#', rowSpan: 2 },
    { content: 'Giocatore', rowSpan: 2, styles: { halign: 'left' as const } },
    ...GRUPPI_TABELLINO.map((gruppo) => ({ content: gruppo.titolo, colSpan: gruppo.colonne.length })),
  ];
  const rigaSottocolonne = [
    ...NUMERI_SET.map((n) => ({ content: String(n), styles: { fillColor: ARDESIA } })),
    ...sottocolonne.map((nome) => ({ content: SOTTOCOLONNA_BREVE[nome] ?? nome, styles: { fillColor: ARDESIA, fontSize: 5.5 } })),
  ];
  const stileTitolo = { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'left' } as const;
  const stileTotale = { fillColor: FONDO_TOTALE, textColor: [0, 0, 0], fontStyle: 'bold' } as const;

  const corpo: (string | number | { content: string | number; colSpan?: number; styles?: object })[][] = [];
  // Per ogni riga del corpo: tipo (per fondi e separatori) e celle Set, lette
  // in didDrawCell per disegnare quadratini e rettangoli.
  const tipiRiga: TipoRiga[] = [];
  const celleSetCorpo: (CellaSet[] | undefined)[] = [];
  for (const sezione of sezioniTabellino({ giocatori: extra.roster, squadra, azioni: dati.tutteLeAzioni, rallies: dati.tutteLeRallies, sets })) {
    corpo.push([
      { content: sezione.titolo, colSpan: colonnaGiocatore + 1, styles: stileTitolo },
      ...sezione.totale.map(() => ({ content: '', styles: stileTitolo })),
    ]);
    tipiRiga.push('titolo');
    celleSetCorpo.push(undefined);
    sezione.righe.forEach((riga, indice) => {
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
      tipiRiga.push(indice % 2 === 1 ? 'giocatoreAlterno' : 'giocatore');
      celleSetCorpo.push(celle);
    });
    corpo.push([
      ...Array.from({ length: colonnaGiocatore }, () => ({ content: '', styles: stileTotale })),
      { content: 'Totale squadra', styles: { ...stileTotale, halign: 'left' } },
      ...sezione.totale.map((valore) => ({ content: valore, styles: stileTotale })),
    ]);
    tipiRiga.push('totale');
    celleSetCorpo.push(undefined);
  }

  const lineaSpessa = (x1: number, y1: number, x2: number, y2: number) => {
    doc.setDrawColor(...BLU_SCURO);
    doc.setLineWidth(SPESSORE_SEPARATORE);
    doc.line(x1, y1, x2, y2);
  };

  autoTable(doc, {
    head: [rigaGruppi, rigaSottocolonne],
    body: corpo,
    startY: 16,
    margin: { left: MARGINE, right: MARGINE, top: 10, bottom: 12 },
    theme: 'grid',
    styles: {
      fontSize: 6, cellPadding: { top: 0.9, bottom: 0.9, left: 0.5, right: 0.5 }, halign: 'center', valign: 'middle',
      lineColor: GRIGIO_RIGHE, lineWidth: 0.1, textColor: TESTO,
    },
    headStyles: { fillColor: BLU_SCURO, textColor: [255, 255, 255], fontSize: 6, fontStyle: 'bold', lineColor: [100, 116, 139] },
    columnStyles: larghezze,
    didParseCell: (data) => {
      if (data.section !== 'body') return;
      const tipo = tipiRiga[data.row.index];
      if (tipo === 'giocatoreAlterno') data.cell.styles.fillColor = FONDO_ALTERNO;
      if ((tipo === 'giocatore' || tipo === 'giocatoreAlterno') && data.column.index >= primaColonnaValori && data.cell.raw === 0) {
        data.cell.styles.textColor = GRIGIO_ZERO;
      }
    },
    didDrawCell: (data) => {
      const indice = data.column.index;
      const { x, y, width, height } = data.cell;

      if (indice < colonneSet) {
        const cx = x + width / 2;
        const cy = y + height / 2;
        doc.setLineWidth(0.2);
        if (data.section === 'head' && data.row.index === 1 && extra.primaBattuta[indice]) {
          doc.setDrawColor(255, 255, 255);
          doc.circle(cx, cy, Math.min(width, height) / 2 - 0.4, 'S');
        } else if (data.section === 'body' && celleSetCorpo[data.row.index]?.[indice]) {
          doc.setDrawColor(0, 0, 0);
          doc.rect(cx - 1.8, cy - 1.4, 3.6, 2.8, 'S');
        }
      }

      // Le celle unite (colSpan) iniziano su una colonna di separatore o non
      // ne attraversano nessuna: basta guardare il bordo sinistro.
      if (indice === 0 || separatori.has(indice)) lineaSpessa(x, y, x, y + height);
      if (indice + (data.cell.colSpan ?? 1) === data.table.columns.length) lineaSpessa(x + width, y, x + width, y + height);
      const tipo = data.section === 'body' ? tipiRiga[data.row.index] : undefined;
      if (tipo === 'titolo' || (data.section === 'head' && data.row.index === 0)) lineaSpessa(x, y, x + width, y);
      if (tipo === 'totale') lineaSpessa(x, y + height, x + width, y + height);
    },
  });

  autoTable(doc, {
    head: [['Punti Vinti', ...COLONNE_PUNTI_VINTI.map((c) => c.titolo)]],
    body: extra.puntiVinti.map(({ etichetta, valori }) => [etichetta, ...COLONNE_PUNTI_VINTI.map((c) => c.valore(valori))]),
    startY: (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6,
    margin: { left: MARGINE, right: MARGINE, bottom: 12 },
    theme: 'grid',
    tableWidth: 'wrap',
    styles: { fontSize: 7, cellPadding: 1.2, halign: 'center', lineColor: GRIGIO_RIGHE, lineWidth: 0.1, textColor: TESTO },
    headStyles: { fillColor: BLU_SCURO, textColor: [255, 255, 255], fontSize: 7 },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    didParseCell: (data) => {
      // L'ultima riga e' il totale della partita.
      if (data.section === 'body' && data.row.index === extra.puntiVinti.length - 1) {
        data.cell.styles.fillColor = FONDO_TOTALE;
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });
}

// Durata "h.mm" di durataSet scritta in minuti, es. "0.27" -> "27'".
function minutiSet(durata: string): string {
  const [ore, minuti] = durata.split('.').map(Number);
  return `${ore * 60 + minuti}'`;
}

// Prima pagina: squadre, data, risultato in set e una riga per set con
// punteggio e durata.
function disegnaCopertina(doc: jsPDF, dati: RiepilogoPartita, nomi: Record<Squadra, string>): void {
  const { match, riepiloghi } = dati;
  const vinti = (s: Squadra) => riepiloghi.filter((r) => r.set.vincitore === s).length;

  doc.setTextColor(...TESTO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(`${nomi.A} - ${nomi.B}`, 14, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Report partita del ${dataItaliana(match.data)}`, 14, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text(`${vinti('A')} - ${vinti('B')}`, 14, 46);
  doc.setFont('helvetica', 'normal');

  autoTable(doc, {
    head: [['Set', nomi.A, nomi.B, 'Durata']],
    body: riepiloghi.map(({ set, punteggioA, punteggioB }) => [
      `Set ${set.numero}`,
      { content: punteggioA, styles: punteggioA > punteggioB ? { fontStyle: 'bold' } : {} },
      { content: punteggioB, styles: punteggioB > punteggioA ? { fontStyle: 'bold' } : {} },
      minutiSet(durataSet(dati.tutteLeAzioni.filter((a) => a.setId === set.id))),
    ]),
    startY: 54,
    margin: { left: 14 },
    theme: 'grid',
    tableWidth: 120,
    styles: { fontSize: 10, cellPadding: 2, halign: 'center', lineColor: GRIGIO_RIGHE, lineWidth: 0.1, textColor: TESTO },
    headStyles: { fillColor: BLU_SCURO, textColor: [255, 255, 255] },
    columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
  });
}

// Piede su ogni pagina: partita e numero di pagina.
function numeraPagine(doc: jsPDF, etichetta: string): void {
  const totale = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totale; pagina += 1) {
    doc.setPage(pagina);
    const larghezza = doc.internal.pageSize.getWidth();
    const altezza = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(etichetta, MARGINE, altezza - 5);
    doc.text(`${pagina} / ${totale}`, larghezza - MARGINE, altezza - 5, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
}

function dataItaliana(iso: string): string {
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}

export async function generaPdfReport(matchId: string): Promise<Blob> {
  const riepilogo = await caricaRiepilogoPartita(matchId);
  const { match, giocatori, tutteLeAzioni } = riepilogo;
  const { data: righeSquadre } = await supabase.from('teams').select('*').in('id', [match.squadraAId, match.squadraBId]);
  const nomeSquadra = (id: string, ripiego: string) => ((righeSquadre ?? []) as Team[]).find((t) => t.id === id)?.nome ?? ripiego;
  const nomi: Record<Squadra, string> = { A: nomeSquadra(match.squadraAId, 'Squadra A'), B: nomeSquadra(match.squadraBId, 'Squadra B') };

  const doc = new jsPDF();
  disegnaCopertina(doc, riepilogo, nomi);

  disegnaTabellino(doc, `Tabellino - ${nomi.A}`, 'A', riepilogo);
  disegnaTabellino(doc, `Tabellino - ${nomi.B}`, 'B', riepilogo);

  const squadre: [Squadra, string][] = [
    ['A', nomi.A],
    ['B', nomi.B],
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

  numeraPagine(doc, `${nomi.A} - ${nomi.B}  ·  ${dataItaliana(match.data)}`);
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
