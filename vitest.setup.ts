import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { fakeSupabase, resetFakeSupabase } from './src/testUtils/fakeSupabase';

// Sostituisce il client Supabase reale con una versione finta in memoria per
// tutti i test (stesso ruolo che aveva fake-indexeddb per Dexie). Ripulita
// prima di ogni test cosi' i test restano isolati tra loro.
vi.mock('@/lib/supabase', () => ({ supabase: fakeSupabase }));
beforeEach(() => {
  resetFakeSupabase();
});

// jsdom non calcola un vero layout: senza questo mock ogni coordinata calcolata
// da un click su un elemento SVG (percentuali sul campo) risulterebbe sempre 0.
// Un riquadro fisso 100x100 con origine (0,0) rende clientX/clientY nei test
// direttamente uguali alla percentuale sul campo (viewBox="0 0 100 100").
if (typeof SVGElement !== 'undefined') {
  SVGElement.prototype.getBoundingClientRect = () =>
    ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
}
