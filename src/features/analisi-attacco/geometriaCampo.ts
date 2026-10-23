import type { EsitoAttacco } from '@/domain/analysis';
import type { Punto } from '@/domain/types';

// Disegno delle mappe attacco, comune alla schermata (SVG) e al PDF. Unita' in
// metri, punto di vista di chi attacca (vedi domain/analisiAttacco).

// Rampa sequenziale blu (chiaro = poco, scuro = tanto) e colori degli esiti:
// palette di riferimento validata anche per chi non distingue bene i colori.
export const RAMPA = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
  '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
];
export const TESTO = '#0b0b0b';
export const TESTO_SECONDARIO = '#52514e';
export const COLORE_CALORE = '#256abf';
export const COLORE_ESITO: Record<EsitoAttacco, string> = { punto: '#1baf7a', difeso: '#2a78d6', errore: '#eb6834' };
export const ETICHETTA_ESITO: Record<EsitoAttacco, string> = { punto: 'Punto (#)', difeso: 'Difeso', errore: 'Errore (= /)' };

// Zone del campo avversario viste da chi attacca: fondo 1-6-5, centro 9-8-7,
// vicino alla rete 2-3-4 (angolo in alto a sinistra di ogni riquadro 3x3 m).
export const NUMERI_ZONE: [string, number, number][] = [
  ['1', 0, 0], ['6', 3, 0], ['5', 6, 0], ['9', 0, 3], ['8', 3, 3], ['7', 6, 3], ['2', 0, 6], ['3', 3, 6], ['4', 6, 6],
];

export function coloreRampa(t: number): { fondo: string; testo: string } {
  const i = Math.round(Math.max(0, Math.min(1, t)) * (RAMPA.length - 1));
  return { fondo: RAMPA[i], testo: i >= 7 ? '#ffffff' : TESTO };
}

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Colore su fondo bianco con una certa opacita' (il PDF non sfuma).
export function mescolaConBianco(hex: string, alfa: number): [number, number, number] {
  const a = Math.max(0, Math.min(1, alfa));
  return rgb(hex).map((c) => Math.round(255 + (c - 255) * a)) as [number, number, number];
}

// Quanto disegnare sotto la rete: abbastanza per le partenze (da seconda linea
// si attacca anche a 6 m dalla rete), mai oltre la propria linea di fondo.
export function fondoPer(punti: Punto[]): number {
  const piuLontano = Math.max(9, ...punti.map((p) => p.y));
  return Math.min(18.7, Math.max(10.2, piuLontano + 0.7));
}

export const versore = (gradi: number): Punto => ({
  x: Math.sin((gradi * Math.PI) / 180),
  y: -Math.cos((gradi * Math.PI) / 180),
});

export function poligonoSettore(origine: Punto, daGradi: number, aGradi: number, raggio = 25): Punto[] {
  const punti = [origine];
  for (let k = 0; k <= 6; k += 1) {
    const v = versore(daGradi + ((aGradi - daGradi) * k) / 6);
    punti.push({ x: origine.x + raggio * v.x, y: origine.y + raggio * v.y });
  }
  return punti;
}

// Dove mettere l'etichetta di uno spicchio: lungo la bisettrice, al 60% del
// tratto dentro il campo avversario. Null se lo spicchio li' e' troppo stretto
// per un'etichetta leggibile o se va all'indietro.
export function puntoEtichetta(origine: Punto, gradi: number, ampiezzaGradi: number): Punto | null {
  const d = versore(gradi);
  if (d.y >= 0) return null;
  const entrata = origine.y > 9 ? (9 - origine.y) / d.y : 0;
  const uscite = [(0 - origine.y) / d.y];
  if (d.x > 1e-9) uscite.push((9 - origine.x) / d.x);
  if (d.x < -1e-9) uscite.push((0 - origine.x) / d.x);
  const uscita = Math.min(...uscite);
  if (uscita <= entrata) return null;
  const t = entrata + 0.6 * (uscita - entrata);
  if (t * ((ampiezzaGradi * Math.PI) / 180) < 1.1) return null;
  return { x: Math.min(8.3, Math.max(0.7, origine.x + t * d.x)), y: origine.y + t * d.y };
}

// Ritaglio di un poligono su un rettangolo (Sutherland-Hodgman).
export function tagliaPoligono(punti: Punto[], xMin: number, yMin: number, xMax: number, yMax: number): Punto[] {
  const bordi: { dentro: (p: Punto) => boolean; incrocio: (a: Punto, b: Punto) => Punto }[] = [
    { dentro: (p) => p.x >= xMin, incrocio: (a, b) => ({ x: xMin, y: a.y + ((b.y - a.y) * (xMin - a.x)) / (b.x - a.x) }) },
    { dentro: (p) => p.x <= xMax, incrocio: (a, b) => ({ x: xMax, y: a.y + ((b.y - a.y) * (xMax - a.x)) / (b.x - a.x) }) },
    { dentro: (p) => p.y >= yMin, incrocio: (a, b) => ({ x: a.x + ((b.x - a.x) * (yMin - a.y)) / (b.y - a.y), y: yMin }) },
    { dentro: (p) => p.y <= yMax, incrocio: (a, b) => ({ x: a.x + ((b.x - a.x) * (yMax - a.y)) / (b.y - a.y), y: yMax }) },
  ];
  let risultato = punti;
  for (const bordo of bordi) {
    const ingresso = risultato;
    risultato = [];
    ingresso.forEach((corrente, i) => {
      const precedente = ingresso[(i + ingresso.length - 1) % ingresso.length];
      if (bordo.dentro(corrente)) {
        if (!bordo.dentro(precedente)) risultato.push(bordo.incrocio(precedente, corrente));
        risultato.push(corrente);
      } else if (bordo.dentro(precedente)) {
        risultato.push(bordo.incrocio(precedente, corrente));
      }
    });
    if (risultato.length === 0) return [];
  }
  return risultato;
}
