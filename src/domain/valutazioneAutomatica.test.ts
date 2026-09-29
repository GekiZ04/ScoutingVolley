import { describe, it, expect } from 'vitest';
import { derivaValutazioneRicezione, derivaValutazioneMuroDaAttacco } from './valutazioneAutomatica';

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

describe('derivaValutazioneMuroDaAttacco', () => {
  it('punto muro (#) quando l attacco e murato per punto (/)', () => {
    expect(derivaValutazioneMuroDaAttacco('/')).toBe('#');
  });

  it('muro negativo (=) quando l attacco fa comunque punto (#) nonostante il tocco', () => {
    expect(derivaValutazioneMuroDaAttacco('#')).toBe('=');
  });

  it('tocco neutro (!) per qualsiasi altra valutazione dell attacco', () => {
    expect(derivaValutazioneMuroDaAttacco('+')).toBe('!');
    expect(derivaValutazioneMuroDaAttacco('!')).toBe('!');
    expect(derivaValutazioneMuroDaAttacco('-')).toBe('!');
    expect(derivaValutazioneMuroDaAttacco('=')).toBe('!');
  });
});
