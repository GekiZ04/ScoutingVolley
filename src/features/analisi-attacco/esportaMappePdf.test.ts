import { describe, it, expect } from 'vitest';
import { attacchiPerAnalisi } from '@/domain/analisiAttacco';
import type { Azione } from '@/domain/types';
import { generaPdfMappeAttacco } from './esportaMappePdf';

let n = 0;
function attacco(extra: Partial<Azione>): Azione {
  n += 1;
  return {
    id: `att${n}`, rallyId: `r${n}`, setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'a4',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '+',
    origine: { x: 40, y: 10 }, destinazione: { x: 90, y: 10 }, toccoMuro: false,
    timestamp: '2026-10-23T10:00:00.000Z', ...extra,
  };
}

async function testo(blob: Blob): Promise<string> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  // Nel PDF le parentesi delle stringhe sono scritte come \( e \).
  return new TextDecoder('latin1').decode(buffer).replace(/\\([()])/g, '$1');
}

describe('generaPdfMappeAttacco', () => {
  const attacchi = attacchiPerAnalisi([
    attacco({ valutazione: '#' }),
    attacco({ valutazione: '+', toccoMuro: true }),
    attacco({ giocatoreId: 'a2', origine: { x: 40, y: 90 }, destinazione: { x: 90, y: 90 }, valutazione: '=' }),
  ]);

  it('esporta tutte le viste con titolo, filtri e numeri', async () => {
    const blob = generaPdfMappeAttacco({
      attacchi,
      attacchiSenzaFase: attacchi,
      titolo: 'Volley Rossi - 2026-10-03',
      filtri: 'Giocatore: tutti | Zona: tutte | Fase: tutte | Set: tutti',
    });
    expect(blob.type).toBe('application/pdf');
    const t = await testo(blob);
    for (const atteso of [
      'Mappe attacco', 'Volley Rossi - 2026-10-03', 'Zona: tutte', '3 attacchi', 'Kill 33%',
      'Mappa di calore', 'Griglia 1 m', '67%', 'Angoli', 'Kill % per angolo', 'Cambio palla', 'Transizione',
      'Traiettorie', 'Punto (#) 1', 'Errore (= /) 1', 'Difeso 1',
    ]) {
      expect(t).toContain(atteso);
    }
  });

  it('senza attacchi esporta comunque, con il messaggio', async () => {
    const t = await testo(generaPdfMappeAttacco({ attacchi: [], attacchiSenzaFase: [], titolo: 'Vuota', filtri: '' }));
    expect(t).toContain('Nessun attacco');
  });
});
