import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  densitaArrivi,
  filtraAttacchi,
  griglia1m,
  riepilogoAttacchi,
  settoriAngolo,
  type AttaccoAnalisi,
  type SettoreAngolo,
} from '@/domain/analisiAttacco';
import type { Punto } from '@/domain/types';
import {
  COLORE_CALORE,
  COLORE_ESITO,
  ETICHETTA_ESITO,
  NUMERI_ZONE,
  coloreRampa,
  fondoPer,
  mescolaConBianco,
  poligonoSettore,
  puntoEtichetta,
  rgb,
  tagliaPoligono,
} from './geometriaCampo';

// Le stesse mappe della schermata "Mappe attacco", disegnate a vettori nel PDF
// (nitide in stampa). Scala: millimetri per metro di campo.
const SCALA = 8;
const MARGINE_CAMPO = 0.7;
const LARGHEZZA_CAMPO = (9 + 2 * MARGINE_CAMPO) * SCALA;
const X_SINISTRA = 14;
const X_DESTRA = X_SINISTRA + LARGHEZZA_CAMPO + 8;

const fmt = (n: number) => `${Math.round(n)}%`;

type Mappa = (m: Punto) => [number, number];

function testoRiepilogo(attacchi: AttaccoAnalisi[]): string {
  const r = riepilogoAttacchi(attacchi);
  const vinto = r.puntoVintoPercento === null ? '-' : fmt(r.puntoVintoPercento);
  return `${r.totale} attacchi - Kill ${fmt(r.killPercento)} - Efficienza ${fmt(r.efficienzaPercento)} - Punto vinto ${vinto}`;
}

// Campo visto da chi attacca (rete in basso); `dati` disegna sotto i numeri
// delle zone e la rete, `sopra` sopra a tutto. Restituisce dove finisce in basso.
function disegnaCampo(
  doc: jsPDF,
  x: number,
  y: number,
  opzioni: {
    titolo: string;
    fondo?: number;
    numeriZone?: boolean;
    // Nel PDF i colori sono pieni: le linee delle zone sotto la mappa di
    // calore sparirebbero, quindi li' vanno ridisegnate sopra.
    lineeZoneSopra?: boolean;
    dati: (p: Mappa) => void;
    sopra?: (p: Mappa) => void;
  },
): number {
  const fondo = opzioni.fondo ?? 9.8;
  doc.setFontSize(11);
  doc.setTextColor(11, 11, 11);
  doc.text(opzioni.titolo, x + LARGHEZZA_CAMPO / 2, y, { align: 'center' });
  const y0 = y + 3;
  const p: Mappa = (m) => [x + (m.x + MARGINE_CAMPO) * SCALA, y0 + (m.y + MARGINE_CAMPO) * SCALA];

  doc.setFillColor(240, 239, 236);
  doc.rect(x, p({ x: 0, y: 9 })[1], LARGHEZZA_CAMPO, (fondo - 9) * SCALA, 'F');
  const [cx, cy] = p({ x: 0, y: 0 });
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(82, 81, 78);
  doc.setLineWidth(0.3);
  doc.rect(cx, cy, 9 * SCALA, 9 * SCALA, 'FD');
  const lineeZone = () => {
    doc.setDrawColor(212, 211, 207);
    doc.setLineWidth(0.15);
    for (const v of [3, 6]) {
      doc.line(...p({ x: v, y: 0 }), ...p({ x: v, y: 9 }));
      doc.line(...p({ x: 0, y: v }), ...p({ x: 9, y: v }));
    }
  };
  lineeZone();
  if (fondo > 12.2) {
    doc.setDrawColor(82, 81, 78);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(...p({ x: 0, y: 12 }), ...p({ x: 9, y: 12 }));
    doc.setLineDashPattern([], 0);
  }

  opzioni.dati(p);
  if (opzioni.lineeZoneSopra) lineeZone();
  doc.setDrawColor(82, 81, 78);
  doc.setLineWidth(0.3);
  doc.rect(cx, cy, 9 * SCALA, 9 * SCALA, 'S');

  if (opzioni.numeriZone ?? true) {
    doc.setFontSize(6);
    doc.setTextColor(82, 81, 78);
    for (const [testo, zx, zy] of NUMERI_ZONE) doc.text(testo, ...p({ x: zx + 0.1, y: zy + 0.32 }));
  }
  doc.setDrawColor(11, 11, 11);
  doc.setLineWidth(0.9);
  doc.line(...p({ x: -MARGINE_CAMPO, y: 9 }), ...p({ x: 9 + MARGINE_CAMPO, y: 9 }));
  opzioni.sopra?.(p);
  return p({ x: 0, y: fondo })[1];
}

function poligono(doc: jsPDF, punti: [number, number][], stile: 'F' | 'FD') {
  if (punti.length < 3) return;
  const [primo, ...resto] = punti;
  const passi = resto.map((q, i) => {
    const prima = i === 0 ? primo : resto[i - 1];
    return [q[0] - prima[0], q[1] - prima[1]];
  });
  doc.lines(passi, primo[0], primo[1], [1, 1], stile, true);
}

function calore(doc: jsPDF, x: number, y: number, attacchi: AttaccoAnalisi[]): number {
  const d = densitaArrivi(attacchi, 0.2);
  return disegnaCampo(doc, x, y, {
    titolo: 'Mappa di calore',
    lineeZoneSopra: true,
    dati: (p) => {
      d.valori.forEach((riga, r) =>
        riga.forEach((v, c) => {
          if (v < 0.03) return;
          doc.setFillColor(...mescolaConBianco(COLORE_CALORE, 0.9 * v ** 1.5));
          const [px, py] = p({ x: d.x0 + c * d.passo, y: d.y0 + r * d.passo });
          doc.rect(px, py, d.passo * SCALA + 0.05, d.passo * SCALA + 0.05, 'F');
        }),
      );
    },
  });
}

function griglia(doc: jsPDF, x: number, y: number, attacchi: AttaccoAnalisi[]): number {
  const g = griglia1m(attacchi);
  const massimo = Math.max(1, ...g.celle.flat());
  const fine = disegnaCampo(doc, x, y, {
    titolo: 'Griglia 1 m',
    numeriZone: false,
    dati: (p) => {
      g.celle.forEach((riga, r) =>
        riga.forEach((conteggio, c) => {
          if (conteggio === 0) return;
          const colore = coloreRampa(conteggio / massimo);
          doc.setFillColor(...rgb(colore.fondo));
          const [px, py] = p({ x: c + 0.04, y: r + 0.04 });
          doc.rect(px, py, 0.92 * SCALA, 0.92 * SCALA, 'F');
          doc.setFontSize(7);
          doc.setTextColor(...rgb(colore.testo));
          doc.text(fmt((conteggio / g.totale) * 100), ...p({ x: c + 0.5, y: r + 0.62 }), { align: 'center' });
        }),
      );
    },
  });
  doc.setFontSize(8);
  doc.setTextColor(82, 81, 78);
  doc.text(`In campo ${g.totale - g.fuori}, fuori campo ${g.fuori}.`, x, fine + 4);
  return fine + 4;
}

function ventaglio(
  doc: jsPDF,
  x: number,
  y: number,
  titolo: string,
  attacchi: AttaccoAnalisi[],
  colore: (s: SettoreAngolo, massimaQuota: number) => { fondo: string; testo: string },
  etichetta: (s: SettoreAngolo) => string[],
): number {
  const { settori, origineMedia } = settoriAngolo(attacchi);
  const pieni = settori.filter((s) => s.n > 0);
  const massimaQuota = Math.max(1, ...pieni.map((s) => s.percentuale));
  return disegnaCampo(doc, x, y, {
    titolo,
    fondo: fondoPer(origineMedia ? [origineMedia] : []),
    numeriZone: false,
    dati: (p) => {
      if (!origineMedia) return;
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      for (const s of pieni) {
        const punti = tagliaPoligono(poligonoSettore(origineMedia, s.daGradi, s.aGradi), 0, 0, 9, 9);
        doc.setFillColor(...rgb(colore(s, massimaQuota).fondo));
        poligono(doc, punti.map(p), 'FD');
      }
    },
    sopra: (p) => {
      if (!origineMedia) return;
      doc.setFillColor(11, 11, 11);
      doc.circle(...p(origineMedia), 0.2 * SCALA, 'F');
      doc.setFontSize(7);
      for (const s of pieni) {
        const punto = puntoEtichetta(origineMedia, (s.daGradi + s.aGradi) / 2, s.aGradi - s.daGradi);
        if (!punto) continue;
        doc.setTextColor(...rgb(colore(s, massimaQuota).testo));
        etichetta(s).forEach((riga, i) => {
          doc.text(riga, ...p({ x: punto.x, y: punto.y + i * 0.38 }), { align: 'center' });
        });
      }
    },
  });
}

function tabellaSettori(doc: jsPDF, x: number, y: number, attacchi: AttaccoAnalisi[]): void {
  const pieni = settoriAngolo(attacchi).settori.filter((s) => s.n > 0);
  if (pieni.length === 0) return;
  autoTable(doc, {
    startY: y,
    margin: { left: x },
    tableWidth: LARGHEZZA_CAMPO,
    head: [['Angolo', 'N', '% attacchi', 'Kill %']],
    body: pieni.map((s) => [`${s.daGradi}° / ${s.aGradi}°`, s.n, fmt(s.percentuale), fmt(s.killPercento)]),
    theme: 'grid',
    styles: { fontSize: 7, cellPadding: 0.8 },
    headStyles: { fillColor: [30, 58, 95] },
  });
}

function traiettorie(doc: jsPDF, x: number, y: number, attacchi: AttaccoAnalisi[]): number {
  const fine = disegnaCampo(doc, x, y, {
    titolo: 'Traiettorie',
    fondo: fondoPer(attacchi.flatMap((a) => [a.origine, a.arrivo])),
    dati: (p) => {
      for (const a of attacchi) {
        const colore = rgb(COLORE_ESITO[a.esito]);
        doc.setDrawColor(...colore);
        doc.setFillColor(...colore);
        doc.setLineWidth(0.35);
        if (a.toccoMuro) doc.setLineDashPattern([1.2, 0.8], 0);
        doc.line(...p(a.origine), ...p(a.arrivo));
        doc.setLineDashPattern([], 0);
        const [ax, ay] = p(a.arrivo);
        const r = 0.15 * SCALA;
        if (a.esito === 'punto') doc.circle(ax, ay, r, 'F');
        if (a.esito === 'difeso') {
          doc.setFillColor(255, 255, 255);
          doc.circle(ax, ay, r, 'FD');
        }
        if (a.esito === 'errore') {
          doc.line(ax - r, ay - r, ax + r, ay + r);
          doc.line(ax - r, ay + r, ax + r, ay - r);
        }
      }
    },
  });
  const conteggi = { punto: 0, difeso: 0, errore: 0 };
  for (const a of attacchi) conteggi[a.esito] += 1;
  let lx = x;
  doc.setFontSize(8);
  for (const esito of ['punto', 'difeso', 'errore'] as const) {
    doc.setDrawColor(...rgb(COLORE_ESITO[esito]));
    doc.setLineWidth(1);
    doc.line(lx, fine + 4, lx + 5, fine + 4);
    doc.setTextColor(11, 11, 11);
    const testo = `${ETICHETTA_ESITO[esito]} ${conteggi[esito]}`;
    doc.text(testo, lx + 6.5, fine + 5);
    lx += 9 + doc.getTextWidth(testo);
  }
  doc.setTextColor(82, 81, 78);
  doc.text('tratteggio = toccato a muro', lx, fine + 5);
  return fine + 5;
}

function intestazione(doc: jsPDF, titolo: string, filtri: string, riepilogo?: string): number {
  doc.setFontSize(15);
  doc.setTextColor(11, 11, 11);
  doc.text(`Mappe attacco - ${titolo}`, X_SINISTRA, 14);
  doc.setFontSize(8);
  doc.setTextColor(82, 81, 78);
  if (filtri) doc.text(filtri, X_SINISTRA, 20);
  if (riepilogo) {
    doc.setFontSize(10);
    doc.setTextColor(11, 11, 11);
    doc.text(riepilogo, X_SINISTRA, 26);
  }
  return 36;
}

/**
 * PDF delle mappe attacco con i filtri scelti: `attacchi` sono gia' filtrati
 * (anche per fase), `attacchiSenzaFase` servono alla vista kill % che mette a
 * confronto cambio palla e transizione.
 */
export function generaPdfMappeAttacco(params: {
  attacchi: AttaccoAnalisi[];
  attacchiSenzaFase: AttaccoAnalisi[];
  titolo: string;
  filtri: string;
}): Blob {
  const { attacchi, attacchiSenzaFase, titolo, filtri } = params;
  const doc = new jsPDF();
  const y = intestazione(doc, titolo, filtri, testoRiepilogo(attacchi));

  if (attacchi.length === 0 && attacchiSenzaFase.length === 0) {
    doc.setFontSize(10);
    doc.text('Nessun attacco con partenza e arrivo per questi filtri.', X_SINISTRA, y);
    return doc.output('blob');
  }

  calore(doc, X_SINISTRA, y, attacchi);
  griglia(doc, X_DESTRA, y, attacchi);

  doc.addPage();
  const yAngoli = intestazione(doc, titolo, filtri, testoRiepilogo(attacchi));
  const fineAngoli = ventaglio(
    doc, X_SINISTRA, yAngoli, 'Angoli', attacchi,
    (s, massima) => coloreRampa(s.percentuale / massima),
    (s) => [fmt(s.percentuale), `N=${s.n}`],
  );
  tabellaSettori(doc, X_DESTRA, yAngoli, attacchi);
  doc.setFontSize(7);
  doc.setTextColor(82, 81, 78);
  doc.text('0° = dritto, angoli positivi verso la destra di chi attacca; punto nero = partenza media.', X_SINISTRA, fineAngoli + 4);

  doc.addPage();
  const yKill = intestazione(doc, titolo, filtri);
  doc.setFontSize(11);
  doc.setTextColor(11, 11, 11);
  doc.text('Kill % per angolo', X_SINISTRA, yKill - 4);
  let fineKill = yKill;
  (['ricezione', 'transizione'] as const).forEach((fase, i) => {
    const diFase = filtraAttacchi(attacchiSenzaFase, { fase });
    const xCampo = i === 0 ? X_SINISTRA : X_DESTRA;
    const fine = ventaglio(
      doc, xCampo, yKill + 4, fase === 'ricezione' ? 'Cambio palla' : 'Transizione', diFase,
      (s) => coloreRampa(s.killPercento / 100),
      (s) => [`Kill ${fmt(s.killPercento)}`, `N=${s.n}`],
    );
    doc.setFontSize(8);
    doc.setTextColor(11, 11, 11);
    doc.text(testoRiepilogo(diFase), xCampo, fine + 4);
    fineKill = Math.max(fineKill, fine + 8);
  });
  (['ricezione', 'transizione'] as const).forEach((fase, i) => {
    tabellaSettori(doc, i === 0 ? X_SINISTRA : X_DESTRA, fineKill, filtraAttacchi(attacchiSenzaFase, { fase }));
  });

  doc.addPage();
  const yTraiettorie = intestazione(doc, titolo, filtri, testoRiepilogo(attacchi));
  traiettorie(doc, X_SINISTRA, yTraiettorie, attacchi);

  return doc.output('blob');
}
