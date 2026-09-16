# Scouting live su campo visuale — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Nota di esecuzione per questo progetto:** su richiesta esplicita dell'utente, la scrittura materiale del codice per ogni task deve essere delegata al modello locale `qwen3.8-27b` servito da LM Studio (API OpenAI-compatibile su `http://localhost:1234/v1`), per non consumare token del modello principale. Il modello principale (Claude) resta responsabile di: preparare il prompt esatto per ogni task (il testo del task stesso, già completo di codice), inviarlo al modello locale, applicare l'output ai file, eseguire i comandi di verifica indicati in ogni step, e correggere di persona qualsiasi discrepanza rispetto a quanto specificato qui prima di passare al task successivo. Nessun task si considera completo se i comandi "Run" del suo step di verifica non sono stati eseguiti e il loro output non è stato controllato.

**Goal:** Sostituire l'input astratto (lista giocatori + `ZoneGrid` a celle numerate) con un campo da pallavolo visuale (SVG): tap sul giocatore posizionato secondo la rotazione, tap di origine e destinazione della traiettoria ovunque sul campo, e un flag "tocco muro" sull'attacco con punto di rimbalzo.

**Architecture:** Nuovo modulo puro `domain/courtPositions.ts` (geometria zone/rotazione/fascia muro) e rework di `domain/analysis.ts` (classificazione per fascia laterale continua invece di lookup di zone numeriche). Nuovo componente condiviso `components/CampoDaGioco.tsx` (SVG, coordinate percentuali 0-100) che sostituisce `ZoneGrid`. I tre flow di scouting (`BattutaFlow`, `RicezioneFlow`, `AttaccoMuroFlow`) montano sempre `CampoDaGioco` insieme ai loro controlli, così il campo resta visibile per tutta la durata del flusso.

**Tech Stack:** React + TypeScript, Vitest + Testing Library (già in uso, nessuna nuova dipendenza).

**Spec:** [docs/superpowers/specs/2026-09-16-court-based-live-scouting-design.md](../specs/2026-09-16-court-based-live-scouting-design.md)

## Global Constraints

- Percentuali 0-100 su tutto il campo: rete fissa a `x = 50`, squadra A in `x ∈ [0,50]`, squadra B in `x ∈ [50,100]`.
- Nessuna migrazione dati: il progetto non ha partite reali salvate, lo schema Dexie non richiede bump di versione (gli indici non referenziano `zona`/`direzione`).
- Ogni task che tocca `vitest run` deve passare prima di passare al task successivo; il progetto compila con `npm run build` solo a fine piano (Task 12), non necessariamente nei task intermedi.
- Terminologia italiana invariata in tutta la UI.

---

### Task 1: `domain/courtPositions.ts` — geometria campo (zone, rotazione, fascia muro)

**Files:**
- Create: `src/domain/courtPositions.ts`
- Test: `src/domain/courtPositions.test.ts`

**Interfaces:**
- Consumes: `Player`, `Squadra` da `@/domain/types`; `Punto` da `@/domain/types` (aggiunto in Step 1 di questo stesso task).
- Produces: `posizioneZona(squadra, zona): Punto`, `costruisciMarker(giocatoriInCampo: Player[], squadra: Squadra): MarkerCampo[]`, `fasciaMuro(squadraAttaccante: Squadra): { xMin: number; xMax: number }`, tipo `MarkerCampo { giocatoreId: string; numero: number; x: number; y: number }`. Usati da Task 3 (CampoDaGioco). Il tipo `Punto` prodotto in Step 1 è consumato anche da Task 2 (`analysis.ts`).

- [ ] **Step 1: Aggiungi il tipo `Punto` a `domain/types.ts`**

In `src/domain/types.ts`, aggiungi (non toccare ancora `Azione`, lo fa Task 2):

```ts
export interface Punto {
  x: number;
  y: number;
}
```

- [ ] **Step 2: Scrivi il test che fallisce**

```ts
// src/domain/courtPositions.test.ts
import { describe, it, expect } from 'vitest';
import { posizioneZona, costruisciMarker, fasciaMuro } from './courtPositions';
import type { Player } from './types';

describe('posizioneZona', () => {
  it('squadra A occupa la metà sinistra del campo (x <= 50)', () => {
    for (let zona = 1; zona <= 6; zona += 1) {
      const p = posizioneZona('A', zona as 1 | 2 | 3 | 4 | 5 | 6);
      expect(p.x).toBeLessThanOrEqual(50);
    }
  });

  it('squadra B è il punto simmetrico rispetto al centro campo (50,50)', () => {
    for (let zona = 1; zona <= 6; zona += 1) {
      const a = posizioneZona('A', zona as 1 | 2 | 3 | 4 | 5 | 6);
      const b = posizioneZona('B', zona as 1 | 2 | 3 | 4 | 5 | 6);
      expect(b.x).toBeCloseTo(100 - a.x);
      expect(b.y).toBeCloseTo(100 - a.y);
    }
  });
});

describe('costruisciMarker', () => {
  it('associa la posizione di rotazione P1..P6 in ordine ai giocatori in campo', () => {
    const giocatori: Player[] = [
      { id: 'p1', teamId: 't', numero: 1, nome: 'Uno', ruolo: 'palleggiatore', attivo: true },
      { id: 'p2', teamId: 't', numero: 2, nome: 'Due', ruolo: 'schiacciatore', attivo: true },
    ];
    const marker = costruisciMarker(giocatori, 'A');
    expect(marker[0]).toEqual({ giocatoreId: 'p1', numero: 1, ...posizioneZona('A', 1) });
    expect(marker[1]).toEqual({ giocatoreId: 'p2', numero: 2, ...posizioneZona('A', 2) });
  });
});

describe('fasciaMuro', () => {
  it('per la squadra A la fascia è appena oltre la rete sul lato B', () => {
    expect(fasciaMuro('A')).toEqual({ xMin: 50, xMax: 55 });
  });

  it('per la squadra B la fascia è appena oltre la rete sul lato A', () => {
    expect(fasciaMuro('B')).toEqual({ xMin: 45, xMax: 50 });
  });
});
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `npm test -- courtPositions`
Expected: FAIL — `Cannot find module './courtPositions'`

- [ ] **Step 4: Implementazione minima**

```ts
// src/domain/courtPositions.ts
import type { Player, Punto, Squadra } from './types';

const POSIZIONI_ZONA_A: Record<1 | 2 | 3 | 4 | 5 | 6, Punto> = {
  1: { x: 8, y: 83 },
  2: { x: 42, y: 83 },
  3: { x: 42, y: 50 },
  4: { x: 42, y: 17 },
  5: { x: 8, y: 17 },
  6: { x: 8, y: 50 },
};

export function posizioneZona(squadra: Squadra, zona: 1 | 2 | 3 | 4 | 5 | 6): Punto {
  const posizioneA = POSIZIONI_ZONA_A[zona];
  if (squadra === 'A') return posizioneA;
  return { x: 100 - posizioneA.x, y: 100 - posizioneA.y };
}

export interface MarkerCampo {
  giocatoreId: string;
  numero: number;
  x: number;
  y: number;
}

export function costruisciMarker(giocatoriInCampo: Player[], squadra: Squadra): MarkerCampo[] {
  return giocatoriInCampo.map((giocatore, indice) => {
    const zona = (indice + 1) as 1 | 2 | 3 | 4 | 5 | 6;
    const { x, y } = posizioneZona(squadra, zona);
    return { giocatoreId: giocatore.id, numero: giocatore.numero, x, y };
  });
}

export function fasciaMuro(squadraAttaccante: Squadra): { xMin: number; xMax: number } {
  return squadraAttaccante === 'A' ? { xMin: 50, xMax: 55 } : { xMin: 45, xMax: 50 };
}
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `npm test -- courtPositions`
Expected: PASS (5 test)

- [ ] **Step 6: Commit**

```bash
git add src/domain/courtPositions.ts src/domain/courtPositions.test.ts
git commit -m "feat: add pure court-geometry helpers (zone positions, rotation markers, block band)"
```

---

### Task 2: `domain/types.ts` + `domain/analysis.ts` — coordinate continue

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/analysis.ts`
- Test: `src/domain/analysis.test.ts` (sovrascrivi interamente)

**Interfaces:**
- Produces: `Azione.origine: Punto | null`, `Azione.destinazione: Punto | null`, `Azione.toccoMuro: boolean` (sostituiscono `zona`/`direzione: number | null`). `fasciaLaterale(y: number): Colonna`, `classificaDirezione(origine: Punto, destinazione: Punto): Direzione`, `isMurato` (ora considera anche `toccoMuro`), `distribuzioneDirezioniAttacco(...): Record<Colonna, number>`.
- Consumes: `Punto` da `@/domain/types` (aggiunto in Task 1, Step 1).

- [ ] **Step 1: Modifica `domain/types.ts`**

Sostituisci i campi di `Azione` (il tipo `Punto` è già stato aggiunto in Task 1):
```ts
  zona: number | null;
  direzione: number | null;
```
con:
```ts
  origine: Punto | null;
  destinazione: Punto | null;
  toccoMuro: boolean;
```

- [ ] **Step 2: Sovrascrivi `domain/analysis.test.ts` con la nuova suite (test che falliranno finché non riscrivi `analysis.ts`)**

```ts
import { describe, it, expect } from 'vitest';
import { classificaDirezione, isMurato, analizzaTendenze, distribuzioneDirezioniAttacco, fasciaLaterale } from './analysis';
import type { Azione, Punto } from './types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 20, y: 10 }, destinazione: { x: 70, y: 15 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

const P = (x: number, y: number): Punto => ({ x, y });

describe('fasciaLaterale', () => {
  it('classifica sinistra, centro, destra per terzi di y', () => {
    expect(fasciaLaterale(10)).toBe('sinistra');
    expect(fasciaLaterale(50)).toBe('centro');
    expect(fasciaLaterale(90)).toBe('destra');
  });
});

describe('classificaDirezione', () => {
  it('stessa fascia laterale è parallela', () => {
    expect(classificaDirezione(P(20, 10), P(70, 15))).toBe('parallela');
  });

  it('fasce laterali opposte è diagonale', () => {
    expect(classificaDirezione(P(20, 10), P(70, 90))).toBe('diagonale');
  });

  it('fascia centrale coinvolta è centro', () => {
    expect(classificaDirezione(P(20, 50), P(70, 10))).toBe('centro');
    expect(classificaDirezione(P(20, 10), P(70, 50))).toBe('centro');
  });
});

describe('isMurato', () => {
  it('è vero se segue un muro avversario con punto nello stesso rally', () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    const successive = [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '#' })];
    expect(isMurato(attacco, successive)).toBe(true);
  });

  it("è vero se l'attacco stesso ha toccoMuro anche senza azione muro successiva", () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco', toccoMuro: true });
    expect(isMurato(attacco, [])).toBe(true);
  });

  it("è falso se il muro successivo è della stessa squadra o non è punto, e non c'è toccoMuro", () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'A', fondamentale: 'muro', valutazione: '#' })])).toBe(false);
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '+' })])).toBe(false);
  });
});

describe('analizzaTendenze', () => {
  it('calcola le percentuali di direzione, murato, errore e il colpo principale', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', origine: P(20, 10), destinazione: P(70, 15), valutazione: '#' }),
      creaAzione({ id: 'att2', rallyId: 'r2', origine: P(20, 10), destinazione: P(70, 15), valutazione: '+' }),
      creaAzione({ id: 'att3', rallyId: 'r3', origine: P(20, 10), destinazione: P(70, 90), valutazione: '=' }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.tentativi).toBe(3);
    expect(tendenze.percParallela).toBeCloseTo((2 / 3) * 100);
    expect(tendenze.percDiagonale).toBeCloseTo((1 / 3) * 100);
    expect(tendenze.colpoPrincipale).toBe('parallela');
    expect(tendenze.percErrore).toBeCloseTo((1 / 3) * 100);
  });

  it('marca murato un attacco seguito da un muro avversario vincente nello stesso rally', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '=' }),
      creaAzione({
        id: 'muro1', rallyId: 'r1', ordine: 2, squadra: 'B', fondamentale: 'muro', valutazione: '#',
        origine: P(52, 50), destinazione: P(45, 50),
      }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percMurato).toBeCloseTo(100);
  });

  it('marca murato anche un attacco con toccoMuro senza azione muro separata', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '!', toccoMuro: true }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percMurato).toBeCloseTo(100);
  });

  it('segnala allerta quando errori+murati superano la soglia', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, valutazione: '=' }),
      creaAzione({ id: 'att2', rallyId: 'r2', ordine: 1, valutazione: '#' }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1', 30);
    expect(tendenze.allerta).toBe(true);
  });

  it('restituisce un risultato neutro senza tentativi', () => {
    const tendenze = analizzaTendenze([], 'p1');
    expect(tendenze.tentativi).toBe(0);
    expect(tendenze.colpoPrincipale).toBeNull();
    expect(tendenze.allerta).toBe(false);
  });
});

describe('distribuzioneDirezioniAttacco', () => {
  it('conta gli attacchi per fascia laterale di destinazione', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', destinazione: P(70, 50) }),
      creaAzione({ id: 'att2', destinazione: P(70, 50) }),
      creaAzione({ id: 'att3', destinazione: P(70, 90) }),
    ];
    expect(distribuzioneDirezioniAttacco(azioni, 'p1')).toEqual({ sinistra: 0, centro: 2, destra: 1 });
  });
});
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `npm test -- analysis`
Expected: FAIL — `classificaDirezione` chiamata con `Punto` ma la vecchia firma prende `number`, `fasciaLaterale` non esiste.

- [ ] **Step 4: Riscrivi `domain/analysis.ts` interamente**

```ts
import type { Azione, Punto } from './types';
import { raggruppaPerRally } from './reducer';

export type Direzione = 'parallela' | 'diagonale' | 'centro';
export type Colonna = 'sinistra' | 'centro' | 'destra';

export function fasciaLaterale(y: number): Colonna {
  if (y < 33.33) return 'sinistra';
  if (y > 66.66) return 'destra';
  return 'centro';
}

export function classificaDirezione(origine: Punto, destinazione: Punto): Direzione {
  const fasciaOrigine = fasciaLaterale(origine.y);
  const fasciaDestinazione = fasciaLaterale(destinazione.y);
  if (fasciaOrigine === 'centro' || fasciaDestinazione === 'centro') return 'centro';
  return fasciaOrigine === fasciaDestinazione ? 'parallela' : 'diagonale';
}

export function isMurato(azioneAttacco: Azione, azioniSuccessiveStessoRally: Azione[]): boolean {
  if (azioneAttacco.toccoMuro) return true;
  return azioniSuccessiveStessoRally.some(
    (a) => a.fondamentale === 'muro' && a.valutazione === '#' && a.squadra !== azioneAttacco.squadra,
  );
}

export interface TendenzeAttaccante {
  giocatoreId: string;
  tentativi: number;
  percParallela: number;
  percDiagonale: number;
  percCentro: number;
  percMurato: number;
  percErrore: number;
  colpoPrincipale: Direzione | null;
  allerta: boolean;
}

const SOGLIA_ALLERTA_DEFAULT = 30;

export function analizzaTendenze(
  tutteLeAzioni: Azione[],
  giocatoreId: string,
  sogliaAllertaPercento: number = SOGLIA_ALLERTA_DEFAULT,
): TendenzeAttaccante {
  const azioniPerRally = raggruppaPerRally(tutteLeAzioni);
  const attacchi = tutteLeAzioni.filter((a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId);
  const tentativi = attacchi.length;

  if (tentativi === 0) {
    return {
      giocatoreId, tentativi: 0, percParallela: 0, percDiagonale: 0, percCentro: 0,
      percMurato: 0, percErrore: 0, colpoPrincipale: null, allerta: false,
    };
  }

  let parallela = 0, diagonale = 0, centro = 0, murati = 0, errori = 0;

  for (const attacco of attacchi) {
    if (attacco.valutazione === '=') errori += 1;
    if (attacco.origine !== null && attacco.destinazione !== null) {
      const direzione = classificaDirezione(attacco.origine, attacco.destinazione);
      if (direzione === 'parallela') parallela += 1;
      else if (direzione === 'diagonale') diagonale += 1;
      else centro += 1;
    }
    const azioniRally = azioniPerRally.get(attacco.rallyId) ?? [];
    const indice = azioniRally.indexOf(attacco);
    const successive = azioniRally.slice(indice + 1);
    if (isMurato(attacco, successive)) murati += 1;
  }

  const percParallela = (parallela / tentativi) * 100;
  const percDiagonale = (diagonale / tentativi) * 100;
  const percCentro = (centro / tentativi) * 100;
  const percMurato = (murati / tentativi) * 100;
  const percErrore = (errori / tentativi) * 100;

  const direzioni: [Direzione, number][] = [
    ['parallela', percParallela],
    ['diagonale', percDiagonale],
    ['centro', percCentro],
  ];
  const colpoPrincipale = direzioni.reduce((max, corrente) => (corrente[1] > max[1] ? corrente : max))[0];

  return {
    giocatoreId, tentativi, percParallela, percDiagonale, percCentro, percMurato, percErrore,
    colpoPrincipale, allerta: percErrore + percMurato > sogliaAllertaPercento,
  };
}

export function distribuzioneDirezioniAttacco(
  tutteLeAzioni: Azione[],
  giocatoreId: string,
): Record<Colonna, number> {
  const attacchi = tutteLeAzioni.filter(
    (a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId && a.destinazione !== null,
  );
  const distribuzione: Record<Colonna, number> = { sinistra: 0, centro: 0, destra: 0 };
  for (const attacco of attacchi) {
    const fascia = fasciaLaterale(attacco.destinazione!.y);
    distribuzione[fascia] += 1;
  }
  return distribuzione;
}
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `npm test -- analysis`
Expected: PASS (tutti i test)

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/domain/analysis.ts src/domain/analysis.test.ts
git commit -m "feat: switch Azione origine/destinazione to continuous coordinates, rework direction analysis"
```

---

### Task 3: `components/CampoDaGioco.tsx` — il campo visuale

**Files:**
- Create: `src/components/CampoDaGioco.tsx`
- Modify: `vitest.setup.ts`
- Delete: `src/components/ZoneGrid.tsx`, `src/components/ZoneGrid.test.tsx`
- Test: `src/components/CampoDaGioco.test.tsx`

**Interfaces:**
- Consumes: `costruisciMarker`, `fasciaMuro`, `MarkerCampo` da `@/domain/courtPositions` (Task 1); `Player`, `Punto`, `Squadra` da `@/domain/types`.
- Produces: componente `CampoDaGioco({ inCampoA, inCampoB, modalita, origineSelezionata? })`, tipo `ModalitaCampo` (union `'inattivo' | 'seleziona-giocatore' | 'seleziona-punto' | 'seleziona-punto-con-fascia-muro'`). Usati da Task 4, 5, 6 (i tre flow).

- [ ] **Step 1: Aggiungi il mock globale di `getBoundingClientRect` per SVG in `vitest.setup.ts`**

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';

// jsdom non calcola un vero layout: senza questo mock ogni coordinata calcolata
// da un click su un elemento SVG (percentuali sul campo) risulterebbe sempre 0.
// Un riquadro fisso 100x100 con origine (0,0) rende clientX/clientY nei test
// direttamente uguali alla percentuale sul campo (viewBox="0 0 100 100").
if (typeof SVGElement !== 'undefined') {
  SVGElement.prototype.getBoundingClientRect = () =>
    ({ width: 100, height: 100, top: 0, left: 0, right: 100, bottom: 100, x: 0, y: 0, toJSON() {} }) as DOMRect;
}
```

- [ ] **Step 2: Scrivi il test che fallisce**

```tsx
// src/components/CampoDaGioco.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoDaGioco } from './CampoDaGioco';
import type { Player } from '@/domain/types';

const giocatoriA: Player[] = [
  { id: 'a1', teamId: 'tA', numero: 1, nome: 'A1', ruolo: 'palleggiatore', attivo: true },
];
const giocatoriB: Player[] = [
  { id: 'b1', teamId: 'tB', numero: 9, nome: 'B1', ruolo: 'centrale', attivo: true },
];

describe('CampoDaGioco', () => {
  it('mostra sempre i marker di entrambe le squadre', () => {
    render(<CampoDaGioco inCampoA={giocatoriA} inCampoB={giocatoriB} modalita={{ tipo: 'inattivo' }} />);
    expect(screen.getByTestId('giocatore-campo-a1')).toBeInTheDocument();
    expect(screen.getByTestId('giocatore-campo-b1')).toBeInTheDocument();
  });

  it('in modalita seleziona-giocatore chiama onSeleziona solo per i marker della squadra attiva', async () => {
    const onSeleziona = vi.fn();
    const user = userEvent.setup();
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'seleziona-giocatore', squadraAttiva: 'B', onSeleziona }}
      />,
    );
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    expect(onSeleziona).toHaveBeenCalledWith('b1');

    onSeleziona.mockClear();
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    expect(onSeleziona).not.toHaveBeenCalled();
  });

  it('in modalita seleziona-punto restituisce le coordinate percentuali del click', () => {
    const onSeleziona = vi.fn();
    render(
      <CampoDaGioco inCampoA={giocatoriA} inCampoB={giocatoriB} modalita={{ tipo: 'seleziona-punto', onSeleziona }} />,
    );
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 70 });
    expect(onSeleziona).toHaveBeenCalledWith({ x: 30, y: 70 });
  });

  it('in modalita seleziona-punto-con-fascia-muro un click sulla fascia chiama onSelezionaMuro invece di onSelezionaPunto', () => {
    const onSelezionaPunto = vi.fn();
    const onSelezionaMuro = vi.fn();
    render(
      <CampoDaGioco
        inCampoA={giocatoriA}
        inCampoB={giocatoriB}
        modalita={{ tipo: 'seleziona-punto-con-fascia-muro', squadraAttaccante: 'A', onSelezionaPunto, onSelezionaMuro }}
      />,
    );
    fireEvent.click(screen.getByTestId('fascia-muro'));
    expect(onSelezionaMuro).toHaveBeenCalled();
    expect(onSelezionaPunto).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 10 });
    expect(onSelezionaPunto).toHaveBeenCalledWith({ x: 10, y: 10 });
  });
});
```

- [ ] **Step 3: Esegui il test e verifica che fallisca**

Run: `npm test -- CampoDaGioco`
Expected: FAIL — `Cannot find module './CampoDaGioco'`

- [ ] **Step 4: Implementazione**

```tsx
// src/components/CampoDaGioco.tsx
import type { MouseEvent } from 'react';
import type { Player, Punto, Squadra } from '@/domain/types';
import { costruisciMarker, fasciaMuro, type MarkerCampo } from '@/domain/courtPositions';

export type ModalitaCampo =
  | { tipo: 'inattivo' }
  | { tipo: 'seleziona-giocatore'; squadraAttiva: Squadra; onSeleziona: (giocatoreId: string) => void }
  | { tipo: 'seleziona-punto'; onSeleziona: (punto: Punto) => void }
  | {
      tipo: 'seleziona-punto-con-fascia-muro';
      squadraAttaccante: Squadra;
      onSelezionaPunto: (punto: Punto) => void;
      onSelezionaMuro: () => void;
    };

function calcolaPunto(evento: MouseEvent<SVGSVGElement>): Punto {
  const rect = evento.currentTarget.getBoundingClientRect();
  const x = ((evento.clientX - rect.left) / rect.width) * 100;
  const y = ((evento.clientY - rect.top) / rect.height) * 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function Marker({ marker, attivo, onClick }: { marker: MarkerCampo; attivo: boolean; onClick: () => void }) {
  return (
    <g
      data-testid={`giocatore-campo-${marker.giocatoreId}`}
      onClick={attivo ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      style={{ cursor: attivo ? 'pointer' : 'default' }}
    >
      <circle cx={marker.x} cy={marker.y} r={4} fill={attivo ? '#2563eb' : '#64748b'} />
      <text x={marker.x} y={marker.y} textAnchor="middle" dominantBaseline="central" fontSize={3.5} fill="white">
        {marker.numero}
      </text>
    </g>
  );
}

export function CampoDaGioco({
  inCampoA,
  inCampoB,
  modalita,
  origineSelezionata,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  modalita: ModalitaCampo;
  origineSelezionata?: Punto | null;
}) {
  const markerA = costruisciMarker(inCampoA, 'A');
  const markerB = costruisciMarker(inCampoB, 'B');

  function handleClickCampo(evento: MouseEvent<SVGSVGElement>) {
    if (modalita.tipo === 'seleziona-punto') modalita.onSeleziona(calcolaPunto(evento));
    if (modalita.tipo === 'seleziona-punto-con-fascia-muro') modalita.onSelezionaPunto(calcolaPunto(evento));
  }

  const clickAbilitato = modalita.tipo === 'seleziona-punto' || modalita.tipo === 'seleziona-punto-con-fascia-muro';
  const fascia = modalita.tipo === 'seleziona-punto-con-fascia-muro' ? fasciaMuro(modalita.squadraAttaccante) : null;

  return (
    <svg
      data-testid="campo-da-gioco"
      viewBox="0 0 100 100"
      className="w-full flex-1 rounded-lg bg-emerald-900"
      onClick={clickAbilitato ? handleClickCampo : undefined}
    >
      <rect x={0} y={0} width={100} height={100} fill="none" stroke="white" strokeWidth={0.5} />
      <line x1={50} y1={0} x2={50} y2={100} stroke="white" strokeWidth={0.8} />
      <line x1={16.67} y1={0} x2={16.67} y2={100} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
      <line x1={83.33} y1={0} x2={83.33} y2={100} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
      {fascia && (
        <rect
          data-testid="fascia-muro"
          x={fascia.xMin}
          y={0}
          width={fascia.xMax - fascia.xMin}
          height={100}
          fill="rgba(220,38,38,0.35)"
          onClick={(e) => {
            e.stopPropagation();
            if (modalita.tipo === 'seleziona-punto-con-fascia-muro') modalita.onSelezionaMuro();
          }}
        />
      )}
      {origineSelezionata && <circle cx={origineSelezionata.x} cy={origineSelezionata.y} r={2} fill="yellow" />}
      {markerA.map((m) => (
        <Marker
          key={m.giocatoreId}
          marker={m}
          attivo={modalita.tipo === 'seleziona-giocatore' && modalita.squadraAttiva === 'A'}
          onClick={() => modalita.tipo === 'seleziona-giocatore' && modalita.onSeleziona(m.giocatoreId)}
        />
      ))}
      {markerB.map((m) => (
        <Marker
          key={m.giocatoreId}
          marker={m}
          attivo={modalita.tipo === 'seleziona-giocatore' && modalita.squadraAttiva === 'B'}
          onClick={() => modalita.tipo === 'seleziona-giocatore' && modalita.onSeleziona(m.giocatoreId)}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 5: Esegui il test e verifica che passi**

Run: `npm test -- CampoDaGioco`
Expected: PASS (4 test)

- [ ] **Step 6: Rimuovi `ZoneGrid`**

Elimina `src/components/ZoneGrid.tsx` e `src/components/ZoneGrid.test.tsx` (saranno sostituiti nei prossimi task; i file che ancora li importano smetteranno di compilare finché non sono aggiornati nei Task 4-6 — atteso).

- [ ] **Step 7: Commit**

```bash
git add -A src/components/CampoDaGioco.tsx src/components/CampoDaGioco.test.tsx vitest.setup.ts src/components/ZoneGrid.tsx src/components/ZoneGrid.test.tsx
git commit -m "feat: add CampoDaGioco court component, remove ZoneGrid"
```

---

### Task 4: `BattutaFlow` — campo sempre visibile, tap origine/destinazione

**Files:**
- Modify: `src/features/live-scouting/BattutaFlow.tsx`
- Test: `src/features/live-scouting/BattutaFlow.test.tsx` (sovrascrivi)

**Interfaces:**
- Consumes: `CampoDaGioco`, `ModalitaCampo` da `@/components/CampoDaGioco` (Task 3); `ValutazioneButtons` (invariato).
- Produces: `BattutaFlow({ inCampoA, inCampoB, onCompleta })`, `DatiBattuta { tipoBattuta, valutazione, origine: Punto, destinazione: Punto }`. Consumato da Task 7 (LiveScoutingScreen).

- [ ] **Step 1: Sovrascrivi il test**

```tsx
// src/features/live-scouting/BattutaFlow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattutaFlow } from './BattutaFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 1)];
const inCampoB = [giocatore('b1', 2)];

describe('BattutaFlow', () => {
  it('il campo resta montato durante tutto il flusso e raccoglie tipo, valutazione, origine e destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={onCompleta} />);

    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();
    await user.click(screen.getByText('Salto flottante'));
    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();
    await user.click(screen.getByText('#'));
    expect(screen.getByTestId('campo-da-gioco')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 20 });

    expect(onCompleta).toHaveBeenCalledWith({
      tipoBattuta: 'salto_flottante',
      valutazione: '#',
      origine: { x: 10, y: 50 },
      destinazione: { x: 90, y: 20 },
    });
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- BattutaFlow`
Expected: FAIL — `BattutaFlow` non accetta ancora `inCampoA`/`inCampoB`, produce ancora `zona`/`direzione`.

- [ ] **Step 3: Riscrivi `BattutaFlow.tsx`**

```tsx
import { useState } from 'react';
import type { Player, TipoBattuta, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiBattuta {
  tipoBattuta: TipoBattuta;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
}

type Passo = 'tipo' | 'valutazione' | 'origine' | 'destinazione';

const TIPI_BATTUTA: { valore: TipoBattuta; etichetta: string }[] = [
  { valore: 'flottante', etichetta: 'Flottante' },
  { valore: 'salto_flottante', etichetta: 'Salto flottante' },
  { valore: 'salto_spin', etichetta: 'Salto spin' },
];

export function BattutaFlow({
  inCampoA,
  inCampoB,
  onCompleta,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  onCompleta: (dati: DatiBattuta) => void;
}) {
  const [passo, setPasso] = useState<Passo>('tipo');
  const [tipoBattuta, setTipoBattuta] = useState<TipoBattuta | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);

  const controlli = (() => {
    if (passo === 'tipo') {
      return (
        <div className="flex gap-3">
          {TIPI_BATTUTA.map((tipo) => (
            <button
              key={tipo.valore}
              type="button"
              onClick={() => { setTipoBattuta(tipo.valore); setPasso('valutazione'); }}
              className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
            >
              {tipo.etichetta}
            </button>
          ))}
        </div>
      );
    }
    if (passo === 'valutazione') {
      return <ValutazioneButtons onSeleziona={(v) => { setValutazione(v); setPasso('origine'); }} />;
    }
    return (
      <p className="text-sm text-slate-400">
        Tocca il campo per registrare {passo === 'origine' ? "l'origine" : 'la destinazione'}.
      </p>
    );
  })();

  const modalita = (() => {
    if (passo === 'origine') {
      return { tipo: 'seleziona-punto' as const, onSeleziona: (p: Punto) => { setOrigine(p); setPasso('destinazione'); } };
    }
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => onCompleta({ tipoBattuta: tipoBattuta!, valutazione: valutazione!, origine: origine!, destinazione: p }),
      };
    }
    return { tipo: 'inattivo' as const };
  })();

  return (
    <div className="flex flex-col gap-4">
      <CampoDaGioco inCampoA={inCampoA} inCampoB={inCampoB} modalita={modalita} origineSelezionata={origine} />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- BattutaFlow`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/live-scouting/BattutaFlow.tsx src/features/live-scouting/BattutaFlow.test.tsx
git commit -m "feat: rewrite BattutaFlow to use the always-visible court"
```

---

### Task 5: `RicezioneFlow` — giocatore sul campo + nuova destinazione

**Files:**
- Modify: `src/features/live-scouting/RicezioneFlow.tsx`
- Test: `src/features/live-scouting/RicezioneFlow.test.tsx` (sovrascrivi)

**Interfaces:**
- Consumes: `CampoDaGioco` (Task 3).
- Produces: `RicezioneFlow({ inCampoA, inCampoB, squadraRicevente, onCompleta })`, `DatiRicezione { giocatoreId, valutazione, origine: Punto, destinazione: Punto }`. Consumato da Task 7. Nota: `GiocatoreInCampo` (tipo usato oggi da `AttaccoMuroFlow`) viene rimosso — Task 6 non lo importerà più.

- [ ] **Step 1: Sovrascrivi il test**

```tsx
// src/features/live-scouting/RicezioneFlow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RicezioneFlow } from './RicezioneFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 1)];
const inCampoB = [giocatore('b1', 5)];

describe('RicezioneFlow', () => {
  it('raccoglie giocatore (tap sul campo), valutazione, origine e destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByTestId('giocatore-campo-b1'));
    await user.click(screen.getByText('!'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 40 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 50 });

    expect(onCompleta).toHaveBeenCalledWith({
      giocatoreId: 'b1',
      valutazione: '!',
      origine: { x: 55, y: 40 },
      destinazione: { x: 60, y: 50 },
    });
  });

  it('tocca solo i marker della squadra ricevente', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
    );
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    expect(onCompleta).not.toHaveBeenCalled();
    expect(screen.queryByText('!')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- RicezioneFlow`
Expected: FAIL — la firma attuale prende `giocatoriInCampo`, non `inCampoA/inCampoB/squadraRicevente`.

- [ ] **Step 3: Riscrivi `RicezioneFlow.tsx`**

```tsx
import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiRicezione {
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
}

type Passo = 'giocatore' | 'valutazione' | 'origine' | 'destinazione';

export function RicezioneFlow({
  inCampoA,
  inCampoB,
  squadraRicevente,
  onCompleta,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  squadraRicevente: Squadra;
  onCompleta: (dati: DatiRicezione) => void;
}) {
  const [passo, setPasso] = useState<Passo>('giocatore');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);

  const controlli =
    passo === 'valutazione' ? (
      <ValutazioneButtons onSeleziona={(v) => { setValutazione(v); setPasso('origine'); }} />
    ) : (
      <p className="text-sm text-slate-400">
        Tocca il campo per registrare {passo === 'giocatore' ? 'il giocatore' : passo === 'origine' ? "l'origine" : 'la destinazione'}.
      </p>
    );

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraRicevente,
        onSeleziona: (id: string) => { setGiocatoreId(id); setPasso('valutazione'); },
      };
    }
    if (passo === 'origine') {
      return { tipo: 'seleziona-punto' as const, onSeleziona: (p: Punto) => { setOrigine(p); setPasso('destinazione'); } };
    }
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => onCompleta({ giocatoreId: giocatoreId!, valutazione: valutazione!, origine: origine!, destinazione: p }),
      };
    }
    return { tipo: 'inattivo' as const };
  })();

  return (
    <div className="flex flex-col gap-4">
      <CampoDaGioco inCampoA={inCampoA} inCampoB={inCampoB} modalita={modalita} origineSelezionata={origine} />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- RicezioneFlow`
Expected: PASS (2 test)

- [ ] **Step 5: Commit**

```bash
git add src/features/live-scouting/RicezioneFlow.tsx src/features/live-scouting/RicezioneFlow.test.tsx
git commit -m "feat: rewrite RicezioneFlow with on-court player tap and new destination point"
```

---

### Task 6: `AttaccoMuroFlow` — giocatore sul campo + tocco muro

**Files:**
- Modify: `src/features/live-scouting/AttaccoMuroFlow.tsx`
- Test: `src/features/live-scouting/AttaccoMuroFlow.test.tsx` (sovrascrivi)

**Interfaces:**
- Consumes: `CampoDaGioco` (Task 3).
- Produces: `AttaccoMuroFlow({ mostraBivio, inCampoA, inCampoB, squadraProtagonista, onCompleta })`, `DatiAttaccoMuro { fondamentale, giocatoreId, valutazione, origine: Punto, destinazione: Punto, toccoMuro: boolean }`. Consumato da Task 7.

- [ ] **Step 1: Sovrascrivi il test**

```tsx
// src/features/live-scouting/AttaccoMuroFlow.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import type { Player } from '@/domain/types';

const giocatore = (id: string, numero: number): Player => (
  { id, teamId: 't', numero, nome: `G${numero}`, ruolo: 'schiacciatore', attivo: true }
);
const inCampoA = [giocatore('a1', 9)];
const inCampoB = [giocatore('b1', 3)];

describe('AttaccoMuroFlow', () => {
  it('quando mostraBivio è falso parte direttamente da giocatore senza mostrare il bivio', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio={false} inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="A" onCompleta={onCompleta} />,
    );

    expect(screen.queryByText('Muro')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('giocatore-campo-a1'));
    await user.click(screen.getByText('#'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 70, clientY: 60 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', giocatoreId: 'a1', valutazione: '#',
      origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
    });
  });

  it('quando mostraBivio è vero mostra prima la scelta Muro/Attacco', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="B" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByText('Muro'));
    await user.click(screen.getByTestId('giocatore-campo-b1'));
    await user.click(screen.getByText('='));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 30 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 20, clientY: 60 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'muro', giocatoreId: 'b1', valutazione: '=',
      origine: { x: 60, y: 30 }, destinazione: { x: 20, y: 60 }, toccoMuro: false,
    });
  });

  it('un attacco toccato dal muro registra toccoMuro true e il punto di rimbalzo come destinazione', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <AttaccoMuroFlow mostraBivio={false} inCampoA={inCampoA} inCampoB={inCampoB} squadraProtagonista="A" onCompleta={onCompleta} />,
    );

    await user.click(screen.getByTestId('giocatore-campo-a1'));
    await user.click(screen.getByText('!'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
    fireEvent.click(screen.getByTestId('fascia-muro'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 15, clientY: 45 });

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', giocatoreId: 'a1', valutazione: '!',
      origine: { x: 30, y: 30 }, destinazione: { x: 15, y: 45 }, toccoMuro: true,
    });
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- AttaccoMuroFlow`
Expected: FAIL — la firma attuale prende `giocatoriInCampo`, non produce `origine`/`toccoMuro`.

- [ ] **Step 3: Riscrivi `AttaccoMuroFlow.tsx`**

```tsx
import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiAttaccoMuro {
  fondamentale: 'attacco' | 'muro';
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
  toccoMuro: boolean;
}

type Passo = 'bivio' | 'giocatore' | 'valutazione' | 'origine' | 'destinazione' | 'rimbalzo-muro';

export function AttaccoMuroFlow({
  mostraBivio,
  inCampoA,
  inCampoB,
  squadraProtagonista,
  onCompleta,
}: {
  mostraBivio: boolean;
  inCampoA: Player[];
  inCampoB: Player[];
  squadraProtagonista: Squadra;
  onCompleta: (dati: DatiAttaccoMuro) => void;
}) {
  const [passo, setPasso] = useState<Passo>(mostraBivio ? 'bivio' : 'giocatore');
  const [fondamentale, setFondamentale] = useState<'attacco' | 'muro'>('attacco');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);

  const controlli = (() => {
    if (passo === 'bivio') {
      return (
        <div className="flex gap-3">
          <button type="button" onClick={() => { setFondamentale('muro'); setPasso('giocatore'); }} className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white">
            Muro
          </button>
          <button type="button" onClick={() => { setFondamentale('attacco'); setPasso('giocatore'); }} className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white">
            Attacco
          </button>
        </div>
      );
    }
    if (passo === 'valutazione') {
      return <ValutazioneButtons onSeleziona={(v) => { setValutazione(v); setPasso('origine'); }} />;
    }
    const etichetta = passo === 'giocatore' ? 'il giocatore' : passo === 'origine' ? "l'origine" : passo === 'rimbalzo-muro' ? 'il punto di rimbalzo dopo il tocco' : 'la destinazione';
    return <p className="text-sm text-slate-400">Tocca il campo per registrare {etichetta}.</p>;
  })();

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraProtagonista,
        onSeleziona: (id: string) => { setGiocatoreId(id); setPasso('valutazione'); },
      };
    }
    if (passo === 'origine') {
      return { tipo: 'seleziona-punto' as const, onSeleziona: (p: Punto) => { setOrigine(p); setPasso('destinazione'); } };
    }
    if (passo === 'destinazione' && fondamentale === 'attacco') {
      return {
        tipo: 'seleziona-punto-con-fascia-muro' as const,
        squadraAttaccante: squadraProtagonista,
        onSelezionaPunto: (p: Punto) =>
          onCompleta({ fondamentale, giocatoreId: giocatoreId!, valutazione: valutazione!, origine: origine!, destinazione: p, toccoMuro: false }),
        onSelezionaMuro: () => setPasso('rimbalzo-muro'),
      };
    }
    if (passo === 'destinazione' || passo === 'rimbalzo-muro') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) =>
          onCompleta({ fondamentale, giocatoreId: giocatoreId!, valutazione: valutazione!, origine: origine!, destinazione: p, toccoMuro: passo === 'rimbalzo-muro' }),
      };
    }
    return { tipo: 'inattivo' as const };
  })();

  return (
    <div className="flex flex-col gap-4">
      <CampoDaGioco inCampoA={inCampoA} inCampoB={inCampoB} modalita={modalita} origineSelezionata={origine} />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- AttaccoMuroFlow`
Expected: PASS (3 test)

- [ ] **Step 5: Commit**

```bash
git add src/features/live-scouting/AttaccoMuroFlow.tsx src/features/live-scouting/AttaccoMuroFlow.test.tsx
git commit -m "feat: rewrite AttaccoMuroFlow with on-court player tap and block-touch redirection"
```

---

### Task 7: `LiveScoutingScreen` — wiring dei nuovi flow

**Files:**
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx`

**Interfaces:**
- Consumes: `BattutaFlow`, `RicezioneFlow`, `AttaccoMuroFlow` con le nuove firme (Task 4, 5, 6).

- [ ] **Step 1: Rimuovi i blocchi non più necessari**

In `LiveScoutingScreen.tsx`, elimina queste righe (sostituite da `inCampoA`/`inCampoB`, già calcolati più sotto nel file):

```ts
  const rotazioneRicevente = squadraRicevente === 'A' ? derivato.rotazioneA : derivato.rotazioneB;
  const giocatoriInCampoRicezione = rotazioneRicevente
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
```

e:

```ts
  const rotazioneProtagonista =
    squadraProtagonista === 'A' ? derivato.rotazioneA : squadraProtagonista === 'B' ? derivato.rotazioneB : [];
  const giocatoriInCampoAttaccoMuro = rotazioneProtagonista
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
```

(Restano invariati: `const squadraRicevente = ...`, `const ultimaAzioneRallyAperto = ...`, `const squadraProtagonista = ...`.)

- [ ] **Step 2: Aggiorna il rendering dei tre flow**

Sostituisci:

```tsx
        {passoAtteso === 'battuta' && (
          <BattutaFlow
            onCompleta={(dati) => {
              const giocatoreId =
                derivato.squadraAlServizio === 'A' ? derivato.rotazioneA[0] : derivato.rotazioneB[0];
              registraAzione({
                squadra: derivato.squadraAlServizio,
                giocatoreId,
                fondamentale: 'battuta',
                ...dati,
              }).catch(segnalaErrore);
            }}
          />
        )}
        {passoAtteso === 'ricezione' && (
          <RicezioneFlow
            giocatoriInCampo={giocatoriInCampoRicezione}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraRicevente,
                fondamentale: 'ricezione',
                tipoBattuta: null,
                direzione: null,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
        {(passoAtteso === 'attacco' || passoAtteso === 'bivio') && squadraProtagonista && (
          <AttaccoMuroFlow
            mostraBivio={passoAtteso === 'bivio'}
            giocatoriInCampo={giocatoriInCampoAttaccoMuro}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraProtagonista,
                tipoBattuta: null,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
```

con:

```tsx
        {passoAtteso === 'battuta' && (
          <BattutaFlow
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            onCompleta={(dati) => {
              const giocatoreId =
                derivato.squadraAlServizio === 'A' ? derivato.rotazioneA[0] : derivato.rotazioneB[0];
              registraAzione({
                squadra: derivato.squadraAlServizio,
                giocatoreId,
                fondamentale: 'battuta',
                toccoMuro: false,
                ...dati,
              }).catch(segnalaErrore);
            }}
          />
        )}
        {passoAtteso === 'ricezione' && (
          <RicezioneFlow
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            squadraRicevente={squadraRicevente}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraRicevente,
                fondamentale: 'ricezione',
                tipoBattuta: null,
                toccoMuro: false,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
        {(passoAtteso === 'attacco' || passoAtteso === 'bivio') && squadraProtagonista && (
          <AttaccoMuroFlow
            mostraBivio={passoAtteso === 'bivio'}
            inCampoA={inCampoA}
            inCampoB={inCampoB}
            squadraProtagonista={squadraProtagonista}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraProtagonista,
                tipoBattuta: null,
                ...dati,
              }).catch(segnalaErrore)
            }
          />
        )}
```

- [ ] **Step 3: Aggiorna i due test che usavano `zone-grid`**

In `LiveScoutingScreen.test.tsx`, aggiungi `fireEvent` all'import da `@testing-library/react` (riga 2):
`import { render, screen, act, within } from '@testing-library/react';` → `import { render, screen, act, within, fireEvent } from '@testing-library/react';`

Nel test `'completa il tap-flow della battuta e registra unazione che aggiorna il punteggio'`, sostituisci:

```ts
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celleDirezione[0]);
```

con:

```ts
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });
```

Nel test `'apre il pannello statistiche e mostra le azioni registrate'`, sostituisci:

```ts
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    let celle = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celle[0]);
    celle = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celle[0]);
    await screen.findByTestId('punteggio');
```

con:

```ts
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });
    await screen.findByTestId('punteggio');
```

- [ ] **Step 4: Esegui l'intera suite di questo file e verifica che passi**

Run: `npm test -- LiveScoutingScreen`
Expected: PASS (tutti i test)

- [ ] **Step 5: Commit**

```bash
git add src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: wire the court-based flows into LiveScoutingScreen"
```

---

### Task 8: Export CSV — colonne coordinate + tocco muro

**Files:**
- Modify: `src/features/export/exportCsv.ts`
- Modify: `src/features/export/exportCsv.test.ts`

- [ ] **Step 1: Aggiorna la fixture e l'assert dell'intestazione in `exportCsv.test.ts`**

Sostituisci (nel `beforeEach`/`creaScenarioBase`):

```ts
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#', zona: 1, direzione: 5,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
```

con:

```ts
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#',
      origine: { x: 8, y: 83 }, destinazione: { x: 92, y: 17 }, toccoMuro: false,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
```

Sostituisci l'assert dell'header:

```ts
    expect(righe[0]).toBe('data,set,rally,squadra,giocatore,fondamentale,tipoBattuta,valutazione,zona,direzione,timestamp');
```

con:

```ts
    expect(righe[0]).toBe(
      'data,set,rally,squadra,giocatore,fondamentale,tipoBattuta,valutazione,origine_x,origine_y,destinazione_x,destinazione_y,toccoMuro,timestamp',
    );
    expect(righe[1]).toContain('8,83,92,17,no');
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- exportCsv`
Expected: FAIL — header e riga non corrispondono ancora.

- [ ] **Step 3: Aggiorna `generaCsvAzioni` in `exportCsv.ts`**

Sostituisci:

```ts
  const intestazione = [
    'data', 'set', 'rally', 'squadra', 'giocatore', 'fondamentale', 'tipoBattuta',
    'valutazione', 'zona', 'direzione', 'timestamp',
  ];
  const righe = [intestazione.join(',')];

  for (const azione of tutteLeAzioni) {
    righe.push(
      [
        escapeCsv(match.data),
        escapeCsv(numeroSetPerSetId.get(azione.setId) ?? ''),
        escapeCsv(numeroRallyPerRallyId.get(azione.rallyId) ?? ''),
        escapeCsv(azione.squadra),
        escapeCsv(nomeGiocatore(azione.giocatoreId)),
        escapeCsv(azione.fondamentale),
        escapeCsv(azione.tipoBattuta),
        escapeCsv(azione.valutazione),
        escapeCsv(azione.zona),
        escapeCsv(azione.direzione),
        escapeCsv(azione.timestamp),
      ].join(','),
    );
  }
```

con:

```ts
  const intestazione = [
    'data', 'set', 'rally', 'squadra', 'giocatore', 'fondamentale', 'tipoBattuta',
    'valutazione', 'origine_x', 'origine_y', 'destinazione_x', 'destinazione_y', 'toccoMuro', 'timestamp',
  ];
  const righe = [intestazione.join(',')];

  const coord = (p: { x: number; y: number } | null): number | null => (p ? Number(p.x.toFixed(1)) : null);
  const coordY = (p: { x: number; y: number } | null): number | null => (p ? Number(p.y.toFixed(1)) : null);

  for (const azione of tutteLeAzioni) {
    righe.push(
      [
        escapeCsv(match.data),
        escapeCsv(numeroSetPerSetId.get(azione.setId) ?? ''),
        escapeCsv(numeroRallyPerRallyId.get(azione.rallyId) ?? ''),
        escapeCsv(azione.squadra),
        escapeCsv(nomeGiocatore(azione.giocatoreId)),
        escapeCsv(azione.fondamentale),
        escapeCsv(azione.tipoBattuta),
        escapeCsv(azione.valutazione),
        escapeCsv(coord(azione.origine)),
        escapeCsv(coordY(azione.origine)),
        escapeCsv(coord(azione.destinazione)),
        escapeCsv(coordY(azione.destinazione)),
        escapeCsv(azione.toccoMuro ? 'si' : 'no'),
        escapeCsv(azione.timestamp),
      ].join(','),
    );
  }
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- exportCsv`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/export/exportCsv.ts src/features/export/exportCsv.test.ts
git commit -m "feat: export origine/destinazione coordinates and toccoMuro in actions CSV"
```

---

### Task 9: `LiveAnalysisPanel` — breakdown per fascia laterale

**Files:**
- Modify: `src/features/live-analysis/LiveAnalysisPanel.tsx`
- Modify: `src/features/live-analysis/LiveAnalysisPanel.test.tsx`

- [ ] **Step 1: Aggiorna `creaAzione` e i due test che dipendevano dalle zone in `LiveAnalysisPanel.test.tsx`**

Sostituisci l'helper:

```ts
function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}
```

con:

```ts
function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 20, y: 10 }, destinazione: { x: 70, y: 15 }, toccoMuro: false,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}
```

Nel primo test (`'mostra il colpo principale per uno schiacciatore'`), sostituisci:

```ts
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', zona: 4, direzione: 5 }),
      creaAzione({ id: 'a2', rallyId: 'r2', zona: 4, direzione: 5, valutazione: '+' }),
      creaAzione({ id: 'a3', rallyId: 'r3', zona: 4, direzione: 1, valutazione: '=' }),
    ];
```

con:

```ts
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1' }),
      creaAzione({ id: 'a2', rallyId: 'r2', valutazione: '+' }),
      creaAzione({ id: 'a3', rallyId: 'r3', destinazione: { x: 70, y: 90 }, valutazione: '=' }),
    ];
```

Sostituisci interamente il secondo test (`'mostra il breakdown per zona 6/5/1 per un centrale'`) con:

```ts
  it('mostra il breakdown per fascia laterale di destinazione per un centrale', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', destinazione: { x: 70, y: 50 } }),
      creaAzione({ id: 'a2', rallyId: 'r2', destinazione: { x: 70, y: 50 } }),
      creaAzione({ id: 'a3', rallyId: 'r3', destinazione: { x: 70, y: 90 } }),
    ];
    render(
      <LiveAnalysisPanel
        azioni={azioni}
        giocatoriA={[creaGiocatore({ ruolo: 'centrale' })]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('sinistra: 0%');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('centro: 67%');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('destra: 33%');
  });
```

Nel terzo test (allerta), la fixture non specifica `zona`/`direzione` esplicitamente ma usa i default: nessuna modifica di quel test oltre all'helper già aggiornato sopra.

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npm test -- LiveAnalysisPanel`
Expected: FAIL — il componente ancora usa `zona`/`direzione`.

- [ ] **Step 3: Aggiorna `LiveAnalysisPanel.tsx`**

Sostituisci l'intestazione del file e `RigaGiocatore`:

```tsx
import { analizzaTendenze, distribuzioneDirezioniAttacco } from '@/domain/analysis';
import type { Azione, Player } from '@/domain/types';

const ZONE_CENTRALE = [6, 5, 1];
```

con:

```tsx
import { analizzaTendenze, distribuzioneDirezioniAttacco, type Colonna } from '@/domain/analysis';
import type { Azione, Player } from '@/domain/types';

const COLONNE: Colonna[] = ['sinistra', 'centro', 'destra'];
```

Sostituisci il blocco centrale in `RigaGiocatore`:

```tsx
  if (giocatore.ruolo === 'centrale') {
    const distribuzione = distribuzioneDirezioniAttacco(azioni, giocatore.id);
    const testoZone = ZONE_CENTRALE.map(
      (z) => `zona ${z}: ${(((distribuzione[z] ?? 0) / tendenze.tentativi) * 100).toFixed(0)}%`,
    ).join(', ');
```

con:

```tsx
  if (giocatore.ruolo === 'centrale') {
    const distribuzione = distribuzioneDirezioniAttacco(azioni, giocatore.id);
    const testoZone = COLONNE.map(
      (c) => `${c}: ${((distribuzione[c] / tendenze.tentativi) * 100).toFixed(0)}%`,
    ).join(', ');
```

(Il resto del componente, incluso il wrapper `LiveAnalysisPanel`, non cambia.)

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npm test -- LiveAnalysisPanel`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/live-analysis/LiveAnalysisPanel.tsx src/features/live-analysis/LiveAnalysisPanel.test.tsx
git commit -m "feat: switch LiveAnalysisPanel middle-blocker breakdown to lateral bands"
```

---

### Task 10: Sweep meccanico delle fixture rimaste (`zona`/`direzione` → `origine`/`destinazione`/`toccoMuro`)

**Files:**
- Modify: `src/domain/reducer.test.ts`
- Modify: `src/domain/stats.test.ts`
- Modify: `src/db/scouting.test.ts`
- Modify: `src/store/liveMatchStore.test.ts`
- Modify: `src/features/live-scouting/flowLogic.test.ts`
- Modify: `src/features/stats-dashboard/StatsPanel.test.tsx`
- Modify: `src/features/history/MatchReportPage.test.tsx`
- Modify: `src/features/export/exportPdf.test.ts`

Questi file costruiscono `Azione` di fixture per testare logica che **non legge mai** `zona`/`direzione`/`origine`/`destinazione` (motore di replay, statistiche per fondamentale, `determinaPassoAtteso`, box score, PDF): il valore delle coordinate è irrilevante, serve solo che il tipo sia valido. Sostituzione uniforme in tutti i file: ovunque compaia `zona: N, direzione: M` (con N/M qualsiasi numero o `null`), sostituisci con `origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false` (se il valore originale era `direzione: null`, usa `destinazione: null` al suo posto, mantenendo `toccoMuro: false`).

- [ ] **Step 1: `src/domain/reducer.test.ts`**

Sostituisci:
```ts
    zona: 1,
    direzione: 5,
```
con:
```ts
    origine: { x: 50, y: 50 },
    destinazione: { x: 50, y: 50 },
    toccoMuro: false,
```

E sostituisci:
```ts
        creaAzione({ id: 'az2', rallyId: 'r1', squadra: 'B', fondamentale: 'ricezione', valutazione: '#', direzione: null }),
```
con:
```ts
        creaAzione({ id: 'az2', rallyId: 'r1', squadra: 'B', fondamentale: 'ricezione', valutazione: '#', destinazione: null }),
```

- [ ] **Step 2: `src/domain/stats.test.ts`**

Sostituisci:
```ts
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 3, direzione: 6,
```
con:
```ts
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
```

- [ ] **Step 3: `src/db/scouting.test.ts`**

Sostituisci:
```ts
    zona: 1,
    direzione: 5,
```
con:
```ts
    origine: { x: 50, y: 50 },
    destinazione: { x: 50, y: 50 },
    toccoMuro: false,
```

- [ ] **Step 4: `src/store/liveMatchStore.test.ts`**

Sostituisci (entrambe le occorrenze, identiche):
```ts
      valutazione: '#', zona: 1, direzione: 5,
```
con:
```ts
      valutazione: '#', origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
```

- [ ] **Step 5: `src/features/live-scouting/flowLogic.test.ts`**

Sostituisci:
```ts
    fondamentale, tipoBattuta: null, valutazione: '#', zona: 1, direzione: 5,
```
con:
```ts
    fondamentale, tipoBattuta: null, valutazione: '#',
    origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
```

- [ ] **Step 6: `src/features/stats-dashboard/StatsPanel.test.tsx`**

Sostituisci:
```ts
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
```
con:
```ts
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
    origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
```

- [ ] **Step 7: `src/features/history/MatchReportPage.test.tsx`**

Sostituisci:
```ts
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#', zona: 1, direzione: 5,
```
con:
```ts
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
```

- [ ] **Step 8: `src/features/export/exportPdf.test.ts`**

Sostituisci:
```ts
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
```
con:
```ts
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '#',
      origine: { x: 50, y: 50 }, destinazione: { x: 50, y: 50 }, toccoMuro: false,
```

- [ ] **Step 9: Esegui tutti i test toccati e verifica che passino**

Run: `npm test -- reducer stats scouting liveMatchStore flowLogic StatsPanel MatchReportPage exportPdf`
Expected: PASS su tutti

- [ ] **Step 10: Commit**

```bash
git add src/domain/reducer.test.ts src/domain/stats.test.ts src/db/scouting.test.ts src/store/liveMatchStore.test.ts src/features/live-scouting/flowLogic.test.ts src/features/stats-dashboard/StatsPanel.test.tsx src/features/history/MatchReportPage.test.tsx src/features/export/exportPdf.test.ts
git commit -m "test: update remaining Azione fixtures to origine/destinazione/toccoMuro"
```

---

### Task 11: `App.integration.test.tsx` — flusso end-to-end sul nuovo campo

**Files:**
- Modify: `src/App.integration.test.tsx`

- [ ] **Step 1: Aggiungi `fireEvent` all'import**

Sostituisci:
```ts
import { render, screen, within, configure } from '@testing-library/react';
```
con:
```ts
import { render, screen, within, configure, fireEvent } from '@testing-library/react';
```

- [ ] **Step 2: Sostituisci il blocco di registrazione della battuta**

Sostituisci:
```ts
    // Live scouting set 1: registra una battuta vincente (ace)
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
    await user.click(celleDirezione[0]);
    expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
```
con:
```ts
    // Live scouting set 1: registra una battuta vincente (ace)
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });
    expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
```

- [ ] **Step 3: Esegui il test e verifica che passi**

Run: `npm test -- App.integration`
Expected: PASS (30s timeout esistente, il test è lungo)

- [ ] **Step 4: Commit**

```bash
git add src/App.integration.test.tsx
git commit -m "test: update end-to-end flow for the court-based battuta interaction"
```

---

### Task 12: Verifica finale — suite completa, build, cleanup

**Files:** nessuno (solo verifica)

- [ ] **Step 1: Esegui l'intera suite di test**

Run: `npm test`
Expected: PASS su tutti i file, nessun riferimento residuo a `zona`/`direzione`/`ZoneGrid`/`giocatoriInCampo`

- [ ] **Step 2: Type-check e build completi**

Run: `npm run build`
Expected: nessun errore TypeScript. Se emergono errori residui (es. un fixture o un import dimenticato in un file non toccato dai task precedenti), correggili applicando lo stesso pattern del Task 10 (rinomina `zona`/`direzione` in `origine`/`destinazione`/`toccoMuro`) prima di procedere.

- [ ] **Step 3: Verifica manuale rapida nel browser**

Run: `npm run dev`, apri l'app, crea due squadre da 6 giocatori, avvia una partita, e verifica a schermo: il campo è visibile durante tipo/valutazione/tap, i marker di entrambe le squadre sono posizionati e cliccabili nei punti giusti, la fascia muro appare durante la destinazione di un attacco e porta a un secondo tap per il rimbalzo.

- [ ] **Step 4: Commit finale (se Step 2 ha richiesto correzioni)**

```bash
git add -A
git commit -m "fix: resolve remaining type errors after the court-based scouting migration"
```

(Salta questo step se il build era già pulito al primo tentativo.)
