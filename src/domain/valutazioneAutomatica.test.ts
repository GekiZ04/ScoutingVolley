import { describe, it, expect } from 'vitest';
import { derivaValutazioneRicezione, derivaValutazioneMuro, derivaValutazioneAttaccoCerta } from './valutazioneAutomatica';

describe('derivaValutazioneRicezione', () => {
  it('perfetta (#) quando il punto cade esattamente sulla zona ideale, squadra A', () => {
    expect(derivaValutazioneRicezione('A', { x: 33.33, y: 50 })).toBe('#');
  });

  it('perfetta (#) quando il punto cade esattamente sulla zona ideale, squadra B', () => {
    expect(derivaValutazioneRicezione('B', { x: 66.67, y: 50 })).toBe('#');
  });

  it('perfetta (#) entro 8 unita dalla zona ideale', () => {
    expect(derivaValutazioneRicezione('A', { x: 33.33, y: 58 })).toBe('#');
  });

  it('positiva (+) tra 8 e 16 unita dalla zona ideale', () => {
    expect(derivaValutazioneRicezione('A', { x: 33.33, y: 65 })).toBe('+');
  });

  it('buona (!) tra 16 e 26 unita dalla zona ideale', () => {
    expect(derivaValutazioneRicezione('A', { x: 33.33, y: 74 })).toBe('!');
  });

  it('scarsa (-) tra 26 e 40 unita dalla zona ideale', () => {
    expect(derivaValutazioneRicezione('A', { x: 33.33, y: 85 })).toBe('-');
  });

  it('molto scarsa (/) oltre 40 unita dalla zona ideale', () => {
    expect(derivaValutazioneRicezione('A', { x: 33.33, y: 95 })).toBe('/');
  });
});

describe('derivaValutazioneMuro', () => {
  it('punto (#) quando il rimbalzo e profondo (profondita >= 30) sul lato di chi ha murato A', () => {
    expect(derivaValutazioneMuro('A', { x: 85, y: 50 })).toBe('#');
  });

  it('positiva (+) quando la profondita e tra 15 e 30, muro di A', () => {
    expect(derivaValutazioneMuro('A', { x: 68, y: 50 })).toBe('+');
  });

  it('insufficiente (!) quando la profondita e tra 0 e 15, muro di A', () => {
    expect(derivaValutazioneMuro('A', { x: 55, y: 50 })).toBe('!');
  });

  it('ritorna null (ambiguo) quando il rimbalzo torna dal lato del muro, muro di A', () => {
    expect(derivaValutazioneMuro('A', { x: 45, y: 50 })).toBeNull();
  });

  it('e speculare per il muro di B (profondita cresce verso x minore)', () => {
    expect(derivaValutazioneMuro('B', { x: 15, y: 50 })).toBe('#');
    expect(derivaValutazioneMuro('B', { x: 55, y: 50 })).toBeNull();
  });
});

describe('derivaValutazioneAttaccoCerta', () => {
  it('murato per punto (/) quando toccoMuro e la valutazione del muro e #', () => {
    expect(derivaValutazioneAttaccoCerta(true, '#')).toBe('/');
  });

  it('ritorna null quando non toccato dal muro', () => {
    expect(derivaValutazioneAttaccoCerta(false, null)).toBeNull();
  });

  it('ritorna null quando toccato ma il muro non ha fatto punto', () => {
    expect(derivaValutazioneAttaccoCerta(true, '+')).toBeNull();
  });
});
