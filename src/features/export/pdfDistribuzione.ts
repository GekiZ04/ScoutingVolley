import type { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ZonaAttacco } from '@/domain/analisiAttacco';
import {
  COLONNE_DISTRIBUZIONE,
  ROTAZIONI_CLICK,
  distribuzionePerFasce,
  distribuzionePerRotazione,
  efficienza,
  kill,
  riepilogoCambioPalla,
  type DatiSetDistribuzione,
  type EsitoAttacchi,
  type FiltroRotazioni,
} from '@/domain/distribuzionePalleggio';
import type { Player, Squadra } from '@/domain/types';
import { SPIEGAZIONE_DISTRIBUZIONE } from '@/features/tabellino/DistribuzionePalleggioTabella';

type Rgb = [number, number, number];
const BLU_SCURO: Rgb = [30, 58, 95];
const GRIGIO_RIGHE: Rgb = [203, 213, 225];
const FONDO_TOTALE: Rgb = [226, 232, 240];
const TESTO: Rgb = [15, 23, 42];
const MARGINE = 7;

type ConUltimaTabella = jsPDF & { lastAutoTable: { finalY: number } };
const fineTabella = (doc: jsPDF) => (doc as ConUltimaTabella).lastAutoTable.finalY;

const stileTabella = {
  theme: 'grid' as const,
  styles: { fontSize: 7, cellPadding: 0.9, halign: 'center' as const, lineColor: GRIGIO_RIGHE, lineWidth: 0.1, textColor: TESTO },
  headStyles: { fillColor: BLU_SCURO, textColor: [255, 255, 255] as Rgb, fontSize: 7, fontStyle: 'bold' as const },
};

function titoloPagina(doc: jsPDF, titolo: string, sottotitolo: string): void {
  doc.addPage('a4', 'landscape');
  doc.setTextColor(...TESTO);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(titolo, MARGINE, 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const larghezza = doc.internal.pageSize.getWidth() - 2 * MARGINE;
  doc.text(doc.splitTextToSize(sottotitolo, larghezza), MARGINE, 17);
}

const percentuale = (n: number, totale: number) => (n && totale ? `${Math.round((n / totale) * 100)}%` : '');
const puntiPercento = (e: EsitoAttacchi) => (e.tot ? `${kill(e)}%` : '-');
const ogni = (quanti: number, punti: number) =>
  punti ? (quanti / punti).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : '-';

// Pagina 1: distribuzione per fasce (una tabella per squadra, affiancate) e
// riquadro cambio palla / contrattacco con la differenza per rotazione.
function paginaFasce(doc: jsPDF, nomi: Record<Squadra, string>, dati: DatiSetDistribuzione[], giocatori: Player[]): void {
  titoloPagina(doc, 'Distribuzione del palleggio', SPIEGAZIONE_DISTRIBUZIONE);
  const larghezzaPagina = doc.internal.pageSize.getWidth();
  const meta = (larghezzaPagina - 2 * MARGINE - 6) / 2;
  const startY = 27;
  let fondo = startY;

  (['A', 'B'] as const).forEach((squadra, i) => {
    const x = MARGINE + i * (meta + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(nomi[squadra], x, startY - 1.5);
    doc.setFont('helvetica', 'normal');
    const { righe, totali } = distribuzionePerFasce(dati, squadra);
    if (righe.length === 0) {
      doc.setFontSize(8);
      doc.text('Nessun attacco rilevato.', x, startY + 4);
      return;
    }
    const larghezze: Record<number, { cellWidth: number; halign?: 'left' }> = { 0: { cellWidth: 6 }, 1: { cellWidth: 26, halign: 'left' } };
    const cella = (meta - 32) / (COLONNE_DISTRIBUZIONE.length * 2);
    COLONNE_DISTRIBUZIONE.forEach((_, c) => {
      larghezze[2 + c * 2] = { cellWidth: cella };
      larghezze[3 + c * 2] = { cellWidth: cella };
    });
    autoTable(doc, {
      ...stileTabella,
      head: [
        [
          { content: '#', rowSpan: 2 },
          { content: 'Atleta', rowSpan: 2, styles: { halign: 'left' } },
          ...COLONNE_DISTRIBUZIONE.map((c) => ({ content: c.etichetta, colSpan: 2 })),
        ],
        COLONNE_DISTRIBUZIONE.map((c) => ({ content: `${totali[c.chiave]} att.`, colSpan: 2 })),
      ],
      body: righe.map(({ giocatoreId, conteggi }) => {
        const g = giocatori.find((x) => x.id === giocatoreId);
        return [
          g?.numero ?? '',
          g?.nome ?? '?',
          ...COLONNE_DISTRIBUZIONE.flatMap((c) => [
            conteggi[c.chiave] || '',
            { content: percentuale(conteggi[c.chiave], totali[c.chiave]), styles: { fontStyle: 'bold' as const } },
          ]),
        ];
      }),
      startY,
      margin: { left: x, right: larghezzaPagina - x - meta, bottom: 12 },
      tableWidth: meta,
      columnStyles: larghezze,
    });
    fondo = Math.max(fondo, fineTabella(doc));
  });

  // Cambio palla e contrattacco, le due squadre a confronto.
  let y = fondo + 9;
  if (y > 150) {
    titoloPagina(doc, 'Cambio palla e contrattacco', '');
    y = 24;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Cambio palla e contrattacco', MARGINE, y - 3);
    doc.setFont('helvetica', 'normal');
  }
  const r = { A: riepilogoCambioPalla(dati, 'A'), B: riepilogoCambioPalla(dati, 'B') };
  const esiti = (e: EsitoAttacchi) => [e.tot, { content: puntiPercento(e), styles: { fontStyle: 'bold' as const } }, e.murati, e.errori];
  const riga = (etichetta: string, valore: (s: Squadra) => string | number) => [
    etichetta,
    { content: valore('A'), colSpan: 4 },
    { content: valore('B'), colSpan: 4 },
  ];
  const sottotitoli = ['Tot', 'Punti %', 'Murati', 'Errori'];
  autoTable(doc, {
    ...stileTabella,
    head: [
      ['', { content: nomi.A, colSpan: 4 }, { content: nomi.B, colSpan: 4 }],
      ['', ...sottotitoli, ...sottotitoli],
    ],
    body: [
      ['1° attacco dopo ric. positiva (# +)', ...esiti(r.A.ricPositiva), ...esiti(r.B.ricPositiva)],
      ['1° attacco dopo ric. negativa (! - /)', ...esiti(r.A.ricNegativa), ...esiti(r.B.ricNegativa)],
      ['Contrattacco', ...esiti(r.A.contrattacco), ...esiti(r.B.contrattacco)],
      riga('Ricezioni', (s) => r[s].ricezioni),
      riga('Punti cambio palla', (s) => r[s].puntiCambioPalla),
      riga('Ricezioni per 1 punto', (s) => ogni(r[s].ricezioni, r[s].puntiCambioPalla)),
      riga('Battute', (s) => r[s].battute),
      riga('Punti break point', (s) => r[s].puntiBreak),
      riga('Battute per 1 break point', (s) => ogni(r[s].battute, r[s].puntiBreak)),
    ],
    startY: y,
    margin: { left: MARGINE, bottom: 12 },
    tableWidth: 160,
    columnStyles: { 0: { halign: 'left', cellWidth: 56 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index < 3) data.cell.styles.fillColor = FONDO_TOTALE;
    },
  });

  // Differenza punti per rotazione del palleggiatore, a destra.
  const diff = (s: Squadra) =>
    r[s].diffRotazione ? ([1, 2, 3, 4, 5, 6] as const).map((p) => { const d = r[s].diffRotazione![p]; return d > 0 ? `+${d}` : String(d); }) : Array(6).fill('-');
  autoTable(doc, {
    ...stileTabella,
    head: [['Diff punti', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6']],
    body: [
      [nomi.A, ...diff('A')],
      [nomi.B, ...diff('B')],
    ],
    startY: y,
    margin: { left: MARGINE + 168, bottom: 12 },
    tableWidth: larghezzaPagina - 2 * MARGINE - 168,
    columnStyles: { 0: { halign: 'left', cellWidth: 40 } },
  });
  doc.setFontSize(6.5);
  doc.text(
    doc.splitTextToSize(
      'Punti % = attacchi punto (#) sul totale; Murati = /, Errori = =. Punti cambio palla = rally vinti in ricezione, ' +
        'break point = rally vinti al servizio. Diff = punti fatti meno subiti con il palleggiatore in quella rotazione.',
      larghezzaPagina - 2 * MARGINE - 168,
    ),
    MARGINE + 168,
    fineTabella(doc) + 4,
  );
}

// Campetto come in app: rete in alto, prima linea 4-3-2, seconda 5-6-1.
const COLONNA: Record<ZonaAttacco, number> = { 4: 0, 3: 1, 2: 2, 5: 0, 6: 1, 1: 2 };
const PRIMA_LINEA = new Set<ZonaAttacco>([4, 3, 2]);

function campetto(doc: jsPDF, x: number, y: number, lato: number, celle: Map<ZonaAttacco, EsitoAttacchi>): void {
  const terzo = lato / 3;
  const totale = [...celle.values()].reduce((s, e) => s + e.tot, 0);
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, lato, lato, 'S');
  doc.line(x, y + terzo, x + lato, y + terzo);
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([0.8, 0.8], 0);
  doc.line(x + terzo, y, x + terzo, y + lato);
  doc.line(x + 2 * terzo, y, x + 2 * terzo, y + lato);
  doc.setLineDashPattern([], 0);
  for (const [zona, e] of celle) {
    const zx = x + COLONNA[zona] * terzo;
    const zy = y + (PRIMA_LINEA.has(zona) ? 0 : terzo);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...TESTO);
    doc.text(`${e.tot} · ${efficienza(e)} · ${kill(e)}`, zx + terzo / 2, zy + 3, { align: 'center' });
    const altezza = Math.max(0.8, (totale ? e.tot / totale : 0) * lato * 0.2);
    doc.setFillColor(156, 163, 175);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);
    doc.rect(zx + 1.5, zy + 4.2, terzo - 3, altezza, 'FD');
  }
  doc.setFont('helvetica', 'normal');
}

const FILTRI_PDF: { filtro: FiltroRotazioni; titolo: string }[] = [
  { filtro: 'ricPositiva', titolo: '1° attacco dopo ricezione positiva (# +)' },
  { filtro: 'ricNegativa', titolo: '1° attacco dopo ricezione negativa (! - /)' },
  { filtro: 'contrattacco', titolo: 'Contrattacco' },
];

// Una pagina per squadra: tre righe (ricezione positiva, negativa,
// contrattacco) di sei campetti P1, P6, P5, P4, P3, P2 come Click&Scout.
function paginaRotazioni(doc: jsPDF, nome: string, squadra: Squadra, dati: DatiSetDistribuzione[]): void {
  titoloPagina(
    doc,
    `Distribuzione per rotazione - ${nome}`,
    'Per ogni zona: totale attacchi · efficienza % (# - / - =) · attacchi punto %. Il rettangolo è la quota degli ' +
      'attacchi della rotazione. Pn = zona del palleggiatore.',
  );
  if (dati.every(({ set }) => !(squadra === 'A' ? set.paleggiatoreIdA : set.paleggiatoreIdB))) {
    doc.setFontSize(9);
    doc.text('Manca il palleggiatore nella formazione dei set: le rotazioni non sono calcolabili.', MARGINE, 30);
    return;
  }
  const lato = 40;
  const spazio = (doc.internal.pageSize.getWidth() - 2 * MARGINE - 6 * lato) / 5;
  let y = 26;
  for (const { filtro, titolo } of FILTRI_PDF) {
    const celle = distribuzionePerRotazione(dati, squadra, filtro);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...TESTO);
    doc.text(titolo, MARGINE, y);
    ROTAZIONI_CLICK.forEach((rot, i) => {
      const x = MARGINE + i * (lato + spazio);
      const perZona = celle.get(rot)!;
      const tot = [...perZona.values()].reduce((s, e) => s + e.tot, 0);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`P${rot}`, x, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(`${tot} att.`, x + lato, y + 5, { align: 'right' });
      campetto(doc, x, y + 6.5, lato, perZona);
    });
    y += lato + 15;
  }
}

/** Pagine del report PDF con distribuzione del palleggio, cambio palla e rotazioni. */
export function disegnaDistribuzionePalleggio(
  doc: jsPDF,
  nomi: Record<Squadra, string>,
  dati: DatiSetDistribuzione[],
  giocatori: Player[],
): void {
  paginaFasce(doc, nomi, dati, giocatori);
  paginaRotazioni(doc, nomi.A, 'A', dati);
  paginaRotazioni(doc, nomi.B, 'B', dati);
}
