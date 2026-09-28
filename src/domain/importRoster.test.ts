import { describe, it, expect } from 'vitest';
import { analizzaCsvRoster, generaModelloCsvRoster } from './importRoster';

describe('analizzaCsvRoster', () => {
  it('importa un roster valido', () => {
    const csv = 'numero,nome,ruolo\n1,Rossi,palleggiatore\n2,Bianchi,opposto';
    const esito = analizzaCsvRoster(csv);
    expect(esito.ok).toBe(true);
    if (esito.ok) {
      expect(esito.giocatori).toEqual([
        { numero: 1, nome: 'Rossi', ruolo: 'palleggiatore' },
        { numero: 2, nome: 'Bianchi', ruolo: 'opposto' },
      ]);
    }
  });

  it('accetta il ruolo scritto in maiuscolo o con spazi attorno', () => {
    const csv = 'numero,nome,ruolo\n 1 , Rossi , PALLEGGIATORE ';
    const esito = analizzaCsvRoster(csv);
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.giocatori).toEqual([{ numero: 1, nome: 'Rossi', ruolo: 'palleggiatore' }]);
  });

  it('ignora le righe vuote', () => {
    const csv = 'numero,nome,ruolo\n1,Rossi,palleggiatore\n\n2,Bianchi,opposto\n';
    const esito = analizzaCsvRoster(csv);
    expect(esito.ok).toBe(true);
    if (esito.ok) expect(esito.giocatori).toHaveLength(2);
  });

  it('rifiuta un file senza la giusta intestazione', () => {
    const esito = analizzaCsvRoster('num,nome,ruolo\n1,Rossi,palleggiatore');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori[0]).toContain('intestazione');
  });

  it('rifiuta un file vuoto', () => {
    const esito = analizzaCsvRoster('');
    expect(esito.ok).toBe(false);
  });

  it('rifiuta un file con solo intestazione e nessun giocatore', () => {
    const esito = analizzaCsvRoster('numero,nome,ruolo');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori[0]).toContain('nessun giocatore');
  });

  it('segnala un ruolo non valido con il numero di riga corretto', () => {
    const csv = 'numero,nome,ruolo\n1,Rossi,palleggiatore\n2,Bianchi,fantasista';
    const esito = analizzaCsvRoster(csv);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori[0]).toBe('Riga 3: ruolo "fantasista" non valido (usa: palleggiatore, opposto, schiacciatore, centrale, libero).');
  });

  it('segnala un numero maglia non valido', () => {
    const esito = analizzaCsvRoster('numero,nome,ruolo\nabc,Rossi,palleggiatore');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori[0]).toContain('numero maglia');
  });

  it('segnala un nome mancante', () => {
    const esito = analizzaCsvRoster('numero,nome,ruolo\n1,,palleggiatore');
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori[0]).toContain('nome mancante');
  });

  it('non importa nulla se anche una sola riga e non valida (tutto o niente)', () => {
    const csv = 'numero,nome,ruolo\n1,Rossi,palleggiatore\n2,Bianchi,fantasista\n3,Verdi,schiacciatore';
    const esito = analizzaCsvRoster(csv);
    expect(esito.ok).toBe(false);
  });

  it('accumula più errori da righe diverse', () => {
    const csv = 'numero,nome,ruolo\nabc,Rossi,palleggiatore\n2,,fantasista';
    const esito = analizzaCsvRoster(csv);
    expect(esito.ok).toBe(false);
    if (!esito.ok) expect(esito.errori.length).toBeGreaterThanOrEqual(3);
  });
});

describe('generaModelloCsvRoster', () => {
  it('genera un modello che analizzaCsvRoster accetta senza errori', () => {
    const esito = analizzaCsvRoster(generaModelloCsvRoster());
    expect(esito.ok).toBe(true);
  });
});
