# Valutazione automatica stile Click&Scout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare battuta/ricezione/attacco/muro al modello "due tap" di Click&Scout — valutazione derivata dalla geometria del tap (o da un default corretto con un tap) invece di un bottone di valutazione esplicito ad ogni azione — allineando anche la scala di valutazione e i colori della traiettoria alla notazione DataVolley.

**Architecture:** Nuovo modulo puro `domain/valutazioneAutomatica.ts` calcola la valutazione da coordinate/contesto; i tre componenti di flusso (`BattutaFlow`, `RicezioneFlow`, `AttaccoMuroFlow`) chiamano queste funzioni invece di mostrare `ValutazioneButtons` come passo bloccante; un nuovo componente `StrisciaUltimaAzione` in `LiveScoutingScreen` permette di correggere con un tap la valutazione appena applicata, aggiornando l'`Azione` già salvata (il punteggio/rotazione si ricalcolano da soli perché già derivati da zero ad ogni render).

**Tech Stack:** React 18 + TypeScript, Zustand, Vitest + Testing Library, Supabase (via client mockato nei test).

**Spec:** `docs/superpowers/specs/2026-09-22-valutazione-automatica-clickscout-design.md`

## Global Constraints

- `Valutazione` ha ora 6 simboli: `'#' | '+' | '!' | '-' | '/' | '='`.
- Nessun cambiamento al `viewBox`/geometria di click di `CampoDaGioco` — niente area "fuori campo" (decisione presa in fase di piano, vedi spec sezione 3).
- Ogni funzione di derivazione vive in `domain/valutazioneAutomatica.ts`, pura, senza dipendenze React.
- `git commit` dopo ogni task che lascia la suite verde (`npx vitest run` deve passare prima di ogni commit).

---

## Task 1: Scala di valutazione a 6 simboli + chiusure rally mancanti

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/reducer.ts`
- Modify: `src/components/ValutazioneButtons.tsx`
- Modify: `src/components/ValutazioneButtons.test.tsx`
- Test: `src/domain/reducer.test.ts`

**Interfaces:**
- Produces: `Valutazione` type con `'/'` incluso; `TABELLA_CHIUSURA` con `attacco:/` e `muro:/`.

- [ ] **Step 1: Scrivi i test falliti per le due nuove chiusure di rally**

Apri `src/domain/reducer.test.ts`, guarda lo stile dei test esistenti per `determinaEsitoAutomatico` e aggiungi:

```ts
it('un attacco murato per punto (valutazione /) chiude il rally a favore della squadra che ha murato', () => {
  const azioni: Azione[] = [
    creaAzione({ id: 'az1', squadra: 'A', fondamentale: 'attacco', valutazione: '/' }),
  ];
  expect(determinaEsitoAutomatico(azioni)).toBe('punto_B');
});

it('un muro in invasione (valutazione /) chiude il rally a favore della squadra avversaria', () => {
  const azioni: Azione[] = [
    creaAzione({ id: 'az1', squadra: 'B', fondamentale: 'muro', valutazione: '/' }),
  ];
  expect(determinaEsitoAutomatico(azioni)).toBe('punto_A');
});
```

Se il file non ha già un helper `creaAzione`, guarda come gli altri test in questo file costruiscono un `Azione` di test e riusa lo stesso pattern (stessi campi obbligatori: `id, rallyId, setId, ordine, squadra, giocatoreId, fondamentale, tipoBattuta, valutazione, origine, destinazione, toccoMuro, timestamp`).

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/domain/reducer.test.ts`
Expected: i due nuovi test FALLISCONO (`determinaEsitoAutomatico` ritorna `null` invece di `'punto_B'`/`'punto_A'`, perché `attacco:/` e `muro:/` non sono ancora in `TABELLA_CHIUSURA` e `'/'` non esiste ancora nel tipo `Valutazione` — probabilmente errore di compilazione TypeScript prima ancora del fallimento a runtime).

- [ ] **Step 3: Aggiungi `/` al tipo `Valutazione`**

In `src/domain/types.ts`, riga 4:

```ts
export type Valutazione = '#' | '+' | '!' | '-' | '/' | '=';
```

- [ ] **Step 4: Aggiungi le due chiusure mancanti a `TABELLA_CHIUSURA`**

In `src/domain/reducer.ts`, sostituisci il blocco `TABELLA_CHIUSURA` con:

```ts
const TABELLA_CHIUSURA: Partial<Record<ChiaveChiusura, 'esecutore' | 'avversario'>> = {
  'battuta:#': 'esecutore',
  'battuta:=': 'avversario',
  'ricezione:=': 'avversario',
  'attacco:#': 'esecutore',
  'attacco:=': 'avversario',
  'attacco:/': 'avversario',
  'muro:#': 'esecutore',
  'muro:=': 'avversario',
  'muro:/': 'avversario',
};
```

- [ ] **Step 5: Esegui i test e verifica che passino**

Run: `npx vitest run src/domain/reducer.test.ts`
Expected: PASS, tutti i test del file.

- [ ] **Step 6: Aggiorna `ValutazioneButtons` per includere `/`**

In `src/components/ValutazioneButtons.tsx`, riga 3:

```ts
const VALUTAZIONI: Valutazione[] = ['#', '+', '!', '-', '/', '='];
```

Aggiorna `src/components/ValutazioneButtons.test.tsx` (il test esistente asserisce 5 bottoni):

```ts
expect(screen.getAllByRole('button')).toHaveLength(6);
```

- [ ] **Step 7: Esegui l'intera suite e verifica che passi**

Run: `npx vitest run`
Expected: PASS, nessuna regressione altrove (grep veloce: nessun altro file assume 5 valori fissi in `ValutazioneButtons`).

- [ ] **Step 8: tsc + commit**

Run: `npx tsc -b`
Expected: nessun errore.

```bash
git add src/domain/types.ts src/domain/reducer.ts src/domain/reducer.test.ts src/components/ValutazioneButtons.tsx src/components/ValutazioneButtons.test.tsx
git commit -m "feat: aggiunge il simbolo di valutazione '/' e le chiusure rally attacco:/ e muro:/"
```

---

## Task 2: Costanti geometriche condivise

**Files:**
- Modify: `src/domain/courtPositions.ts`
- Modify: `src/domain/analysis.ts`
- Modify: `src/components/CampoDaGioco.tsx`
- Test: `src/domain/courtPositions.test.ts`

**Interfaces:**
- Produces: `RETE_X`, `LINEA_TRE_METRI_A`, `LINEA_TRE_METRI_B` esportate da `src/domain/courtPositions.ts`.
- Consumes (Task 3): questo task deve finire prima del Task 3, che importa `LINEA_TRE_METRI_A`/`LINEA_TRE_METRI_B` da qui.

- [ ] **Step 1: Scrivi il test fallito per le nuove costanti**

In `src/domain/courtPositions.test.ts`, aggiungi (adatta l'import esistente in cima al file se necessario):

```ts
import { RETE_X, LINEA_TRE_METRI_A, LINEA_TRE_METRI_B } from './courtPositions';

it('espone le costanti geometriche condivise del campo', () => {
  expect(RETE_X).toBe(50);
  expect(LINEA_TRE_METRI_A).toBeCloseTo(33.33, 1);
  expect(LINEA_TRE_METRI_B).toBeCloseTo(66.67, 1);
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/domain/courtPositions.test.ts`
Expected: FAIL — `RETE_X` non è esportato (errore di modulo/undefined).

- [ ] **Step 3: Aggiungi le costanti a `courtPositions.ts`**

In `src/domain/courtPositions.ts`, subito dopo l'import in cima al file:

```ts
export const RETE_X = 50;
export const LINEA_TRE_METRI_A = 33.33;
export const LINEA_TRE_METRI_B = 66.67;
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/domain/courtPositions.test.ts`
Expected: PASS.

- [ ] **Step 5: Sostituisci i valori duplicati in `analysis.ts` e `CampoDaGioco.tsx`**

In `src/domain/analysis.ts`, aggiungi l'import e sostituisci i letterali:

```ts
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B } from './courtPositions';
```

```ts
export function fasciaLaterale(y: number): Colonna {
  if (y < 33.33) return 'sinistra';
  if (y > 66.66) return 'destra';
  return 'centro';
}
```

**Nota:** questi due valori (`33.33`/`66.66`) in `fasciaLaterale` sono soglie sull'asse `y` (larghezza campo, terzi sinistra/centro/destra), concettualmente diverse dalle linee dei 3 metri (che sono sull'asse `x`, profondità campo) — **non vanno sostituite** con `LINEA_TRE_METRI_A/B` nonostante il valore numerico coincidente: sarebbe un refactor scorretto che confonderebbe due concetti geometrici diversi. Lascia `fasciaLaterale` invariata; l'import di `LINEA_TRE_METRI_A/B` in questo file non serve davvero — **non aggiungerlo**. Salta questa parte dello step per `analysis.ts`.

In `src/components/CampoDaGioco.tsx`, aggiungi l'import in cima:

```ts
import { costruisciMarker, fasciaMuro, RETE_X, LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, ZONE_PRIMA_LINEA, type MarkerCampo } from '@/domain/courtPositions';
```

E sostituisci le tre righe che oggi usano i letterali (righe 141-143 circa):

```tsx
<line x1={LINEA_TRE_METRI_A} y1={0} x2={LINEA_TRE_METRI_A} y2={ALTEZZA_VIEWBOX} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
<line x1={LINEA_TRE_METRI_B} y1={0} x2={LINEA_TRE_METRI_B} y2={ALTEZZA_VIEWBOX} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
<line x1={RETE_X} y1={0} x2={RETE_X} y2={ALTEZZA_VIEWBOX} stroke="#fbbf24" strokeWidth={1} />
```

- [ ] **Step 6: Esegui l'intera suite e verifica che passi**

Run: `npx vitest run`
Expected: PASS (nessuna assert dipende dal fatto che i numeri vengano da un letterale o da una costante — il valore renderizzato è identico).

- [ ] **Step 7: tsc + commit**

Run: `npx tsc -b`
Expected: nessun errore.

```bash
git add src/domain/courtPositions.ts src/domain/courtPositions.test.ts src/components/CampoDaGioco.tsx
git commit -m "refactor: centralizza le costanti geometriche del campo (rete, linee 3 metri)"
```

---

## Task 3: Modulo `domain/valutazioneAutomatica.ts`

**Files:**
- Create: `src/domain/valutazioneAutomatica.ts`
- Test: `src/domain/valutazioneAutomatica.test.ts`

**Interfaces:**
- Consumes: `LINEA_TRE_METRI_A`, `LINEA_TRE_METRI_B` da `./courtPositions` (Task 2); `Punto`, `Squadra`, `Valutazione` da `./types`.
- Produces:
  - `derivaValutazioneRicezione(squadra: Squadra, destinazione: Punto): Valutazione`
  - `derivaValutazioneMuro(squadraBloccante: Squadra, rimbalzo: Punto): Valutazione | null`
  - `derivaValutazioneAttaccoCerta(toccoMuro: boolean, valutazioneMuro: Valutazione | null): Valutazione | null`

- [ ] **Step 1: Scrivi i test falliti per `derivaValutazioneRicezione`**

Crea `src/domain/valutazioneAutomatica.test.ts`:

```ts
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
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/domain/valutazioneAutomatica.test.ts`
Expected: FAIL — il modulo `./valutazioneAutomatica` non esiste ancora.

- [ ] **Step 3: Implementa il modulo**

Crea `src/domain/valutazioneAutomatica.ts`:

```ts
import { LINEA_TRE_METRI_A, LINEA_TRE_METRI_B } from './courtPositions';
import type { Punto, Squadra, Valutazione } from './types';

function zonaIdealeRicezione(squadra: Squadra): Punto {
  return squadra === 'A' ? { x: LINEA_TRE_METRI_A, y: 50 } : { x: LINEA_TRE_METRI_B, y: 50 };
}

export function derivaValutazioneRicezione(squadra: Squadra, destinazione: Punto): Valutazione {
  const ideale = zonaIdealeRicezione(squadra);
  const distanza = Math.hypot(destinazione.x - ideale.x, destinazione.y - ideale.y);
  if (distanza <= 8) return '#';
  if (distanza <= 16) return '+';
  if (distanza <= 26) return '!';
  if (distanza <= 40) return '-';
  return '/';
}

export function derivaValutazioneMuro(squadraBloccante: Squadra, rimbalzo: Punto): Valutazione | null {
  const profondita = squadraBloccante === 'A' ? rimbalzo.x - 50 : 50 - rimbalzo.x;
  if (profondita >= 30) return '#';
  if (profondita >= 15) return '+';
  if (profondita >= 0) return '!';
  return null;
}

export function derivaValutazioneAttaccoCerta(
  toccoMuro: boolean,
  valutazioneMuro: Valutazione | null,
): Valutazione | null {
  if (toccoMuro && valutazioneMuro === '#') return '/';
  return null;
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/domain/valutazioneAutomatica.test.ts`
Expected: PASS, tutti i casi.

- [ ] **Step 5: tsc + commit**

Run: `npx tsc -b && npx vitest run`
Expected: nessun errore, suite verde.

```bash
git add src/domain/valutazioneAutomatica.ts src/domain/valutazioneAutomatica.test.ts
git commit -m "feat: aggiunge il modulo di derivazione automatica della valutazione (ricezione, muro, attacco)"
```

---

## Task 4: `BattutaFlow.tsx` — ricezione auto-derivata

**Files:**
- Modify: `src/features/live-scouting/BattutaFlow.tsx`
- Modify: `src/features/live-scouting/BattutaFlow.test.tsx`

**Interfaces:**
- Consumes: `derivaValutazioneRicezione` da `@/domain/valutazioneAutomatica` (Task 3).

- [ ] **Step 1: Aggiorna il test esistente che oggi clicca un bottone di valutazione**

In `src/features/live-scouting/BattutaFlow.test.tsx`, nel terzo test ("toccando chi riceve..."), rimuovi la riga `await user.click(screen.getByText('+'));` (il tap sul campo a `{clientX:55, clientY:40}` con `squadraRicevente="B"` deriva geometricamente `+` — distanza dalla zona ideale B `(66.67,50)` è `Math.hypot(55-66.67, 40-50) ≈ 15.4`, dentro la banda `≤16` — quindi il risultato atteso resta identico a quello già scritto, non serve cambiare l'`expect`).

Il test diventa:

```ts
it('toccando chi riceve si registra anche la ricezione, e la battuta prende una valutazione derivata', async () => {
  const onCompleta = vi.fn();
  const user = userEvent.setup();
  render(<BattutaFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />);

  await fissaTipoOrigineDestinazione(user);
  await user.click(screen.getByTestId('giocatore-campo-b1'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 40 });

  expect(onCompleta).toHaveBeenCalledWith(
    {
      tipoBattuta: 'salto_flottante', valutazione: '-',
      origine: { x: 10, y: 50 }, destinazione: { x: 90, y: 20 },
    },
    {
      giocatoreId: 'b1', valutazione: '+',
      origine: { x: 55, y: 40 },
    },
  );
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/features/live-scouting/BattutaFlow.test.tsx`
Expected: FAIL — il flusso attuale si ferma al passo `ricezione-valutazione` aspettando un click su un bottone, `onCompleta` non viene mai chiamato.

- [ ] **Step 3: Modifica `BattutaFlow.tsx`**

In `src/features/live-scouting/BattutaFlow.tsx`:

Aggiorna l'import in cima:

```ts
import { derivaValutazioneRicezione } from '@/domain/valutazioneAutomatica';
```

Aggiorna `DERIVA_BATTUTA_DA_RICEZIONE` (aggiunge la voce mancante per `/`):

```ts
const DERIVA_BATTUTA_DA_RICEZIONE: Partial<Record<Valutazione, Valutazione>> = {
  '#': '-',
  '+': '-',
  '!': '!',
  '-': '+',
  '/': '/',
};
```

Rimuovi `'ricezione-valutazione'` dal tipo `Passo`:

```ts
type Passo = 'tipo' | 'origine' | 'destinazione' | 'esito' | 'ricezione-origine';
```

Sostituisci il blocco `modalita` per il passo `'ricezione-origine'` così che completi subito invece di passare a un altro passo:

```ts
if (passo === 'ricezione-origine') {
  return {
    tipo: 'seleziona-punto' as const,
    onSeleziona: (p: Punto) => {
      setRiceOrigine(p);
      completaConRicezione(derivaValutazioneRicezione(squadraRicevente, p));
    },
  };
}
```

Rimuovi il ramo `if (passo === 'ricezione-valutazione')` dal blocco `controlli` (non serve più: non esiste più quel passo).

L'etichetta di istruzione generica in fondo a `controlli` resta valida così com'è (già gestisce `'ricezione-origine'` con il testo "dove riceve").

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/features/live-scouting/BattutaFlow.test.tsx`
Expected: PASS, tutti i test del file (inclusi i primi due, Ace diretto ed Errore diretto, invariati).

- [ ] **Step 5: tsc + suite completa + commit**

Run: `npx tsc -b && npx vitest run`
Expected: nessun errore.

```bash
git add src/features/live-scouting/BattutaFlow.tsx src/features/live-scouting/BattutaFlow.test.tsx
git commit -m "feat: deriva automaticamente la valutazione della ricezione nel flusso battuta"
```

---

## Task 5: `RicezioneFlow.tsx` (standalone) — auto-derivata

**Files:**
- Modify: `src/features/live-scouting/RicezioneFlow.tsx`
- Modify: `src/features/live-scouting/RicezioneFlow.test.tsx`

**Interfaces:**
- Consumes: `derivaValutazioneRicezione` da `@/domain/valutazioneAutomatica` (Task 3).

- [ ] **Step 1: Aggiorna il test esistente**

In `src/features/live-scouting/RicezioneFlow.test.tsx`, primo test: rimuovi `await user.click(screen.getByText('!'));` e correggi il valore atteso a `'+'` (stessa distanza geometrica calcolata nel Task 4: squadra B, punto `(55,40)`, distanza ≈15.4 → banda `≤16` → `'+'`):

```ts
it('raccoglie giocatore (tap sul campo), origine e valutazione: solo qualita, nessuna traiettoria', async () => {
  const onCompleta = vi.fn();
  const user = userEvent.setup();
  render(
    <RicezioneFlow inCampoA={inCampoA} inCampoB={inCampoB} squadraRicevente="B" onCompleta={onCompleta} />,
  );

  await user.click(screen.getByTestId('giocatore-campo-b1'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 40 });

  expect(onCompleta).toHaveBeenCalledWith({
    giocatoreId: 'b1',
    valutazione: '+',
    origine: { x: 55, y: 40 },
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/features/live-scouting/RicezioneFlow.test.tsx`
Expected: FAIL — il componente attuale resta fermo al passo `valutazione`.

- [ ] **Step 3: Modifica `RicezioneFlow.tsx`**

Aggiorna l'import in cima:

```ts
import { derivaValutazioneRicezione } from '@/domain/valutazioneAutomatica';
```

Rimuovi `'valutazione'` dal tipo `Passo`:

```ts
type Passo = 'giocatore' | 'origine';
```

Sostituisci il blocco `modalita` per il passo `'origine'`:

```ts
if (passo === 'origine') {
  return {
    tipo: 'seleziona-punto' as const,
    onSeleziona: (p: Punto) => {
      setOrigine(p);
      onCompleta({ giocatoreId: giocatoreId!, valutazione: derivaValutazioneRicezione(squadraRicevente, p), origine: p });
    },
  };
}
```

Semplifica `controlli` (non esiste più il ramo `'valutazione'`):

```ts
const controlli = (
  <p className="text-sm text-slate-400">
    Tocca il campo per registrare {passo === 'giocatore' ? 'il giocatore' : 'dove riceve'}.
  </p>
);
```

(rimuovi l'import di `ValutazioneButtons` se non più usato altrove nel file — verifica con una ricerca nel file stesso prima di toglierlo).

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/features/live-scouting/RicezioneFlow.test.tsx`
Expected: PASS, entrambi i test del file.

- [ ] **Step 5: tsc + suite completa + commit**

Run: `npx tsc -b && npx vitest run`
Expected: nessun errore.

```bash
git add src/features/live-scouting/RicezioneFlow.tsx src/features/live-scouting/RicezioneFlow.test.tsx
git commit -m "feat: deriva automaticamente la valutazione nel flusso di ricezione standalone"
```

---

## Task 6: `AttaccoMuroFlow.tsx` — attacco/muro/tocco auto-derivati

**Files:**
- Modify: `src/features/live-scouting/AttaccoMuroFlow.tsx`
- Modify: `src/features/live-scouting/AttaccoMuroFlow.test.tsx`

**Interfaces:**
- Consumes: `derivaValutazioneMuro`, `derivaValutazioneAttaccoCerta` da `@/domain/valutazioneAutomatica` (Task 3).

- [ ] **Step 1: Aggiorna i test esistenti**

In `src/features/live-scouting/AttaccoMuroFlow.test.tsx`:

Secondo test ("quando mostraBivio è falso..."): rimuovi `await user.click(screen.getByText('#'));`, cambia il valore atteso a `'+'` (nessun tocco muro → `derivaValutazioneAttaccoCerta(false, null)` ritorna `null` → default `+`):

```ts
it('quando mostraBivio è falso parte direttamente da giocatore, poi traiettoria, poi completa con valutazione derivata', async () => {
  const onCompleta = vi.fn();
  const user = userEvent.setup();
  render(
    <AttaccoMuroFlow mostraBivio={false} inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={onCompleta} />,
  );

  expect(screen.queryByText('Muro')).not.toBeInTheDocument();
  await user.click(screen.getByTestId('giocatore-campo-a1'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 70, clientY: 60 });

  expect(onCompleta).toHaveBeenCalledWith({
    fondamentale: 'attacco', squadra: 'A', giocatoreId: 'a1', valutazione: '+',
    origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
  });
});
```

Terzo test ("quando mostraBivio è vero..."): rimuovi `await user.click(screen.getByText('='));`, cambia il valore atteso a `'#'` (muro di B, rimbalzo `x=20` → `profondita = 50-20 = 30` → banda `>=30` → `'#'`):

```ts
it('quando mostraBivio è vero mostra prima la scelta Muro/Attacco, poi il giocatore scelto puo essere di qualsiasi squadra', async () => {
  const onCompleta = vi.fn();
  const user = userEvent.setup();
  render(
    <AttaccoMuroFlow mostraBivio inCampoA={inCampoA} inCampoB={inCampoB} onCompleta={onCompleta} />,
  );

  await user.click(screen.getByText('Muro'));
  await user.click(screen.getByTestId('giocatore-campo-b1'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 60, clientY: 30 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 20, clientY: 60 });

  expect(onCompleta).toHaveBeenCalledWith({
    fondamentale: 'muro', squadra: 'B', giocatoreId: 'b1', valutazione: '#',
    origine: { x: 60, y: 30 }, destinazione: { x: 20, y: 60 }, toccoMuro: false,
  });
});
```

Quarto test ("un attacco toccato dal muro..."): rimuovi entrambi i click su bottoni (`'+'` e `'!'`), aggiorna i valori attesi. Rimbalzo del tocco = `destinazione` salvata nel passo `rimbalzo-muro` = `(15,45)`; squadra bloccante = `B` (l'attaccante è `A`); `profondita = 50 - 15 = 35` → `>=30` → tocco valutato `'#'`. Con `toccoMuro=true` e `valutazioneMuro='#'`, `derivaValutazioneAttaccoCerta` ritorna `'/'` per l'attacco:

```ts
it('un attacco toccato dal muro fa valutare anche il tocco e il giocatore di prima linea che lo ha fatto', async () => {
  const onCompleta = vi.fn();
  const user = userEvent.setup();
  render(
    <AttaccoMuroFlow
      mostraBivio={false}
      inCampoA={inCampoA}
      inCampoB={inCampoBSei}
      onCompleta={onCompleta}
    />,
  );

  await user.click(screen.getByTestId('giocatore-campo-a1'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 30, clientY: 30 });
  fireEvent.click(screen.getByTestId('fascia-muro'), { clientX: 52, clientY: 40 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 15, clientY: 45 });

  expect(screen.getByTestId('giocatore-campo-b1')).toHaveAttribute('data-attivo', 'false');
  expect(screen.getByTestId('giocatore-campo-b3')).toHaveAttribute('data-attivo', 'true');
  await user.click(screen.getByTestId('giocatore-campo-b3'));

  expect(onCompleta).toHaveBeenCalledWith(
    {
      fondamentale: 'attacco', squadra: 'A', giocatoreId: 'a1', valutazione: '/',
      origine: { x: 30, y: 30 }, destinazione: { x: 15, y: 45 }, toccoMuro: true,
    },
    { giocatoreId: 'b3', valutazione: '#', origine: { x: 52, y: 40 } },
  );
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/features/live-scouting/AttaccoMuroFlow.test.tsx`
Expected: FAIL — il flusso attuale resta fermo ad attendere i tap sui bottoni di valutazione.

- [ ] **Step 3: Modifica `AttaccoMuroFlow.tsx`**

Aggiorna l'import in cima:

```ts
import { derivaValutazioneMuro, derivaValutazioneAttaccoCerta } from '@/domain/valutazioneAutomatica';
```

Rimuovi `'tocco-valutazione'` e `'valutazione'` dal tipo `Passo`:

```ts
type Passo =
  | 'bivio'
  | 'giocatore'
  | 'origine'
  | 'destinazione'
  | 'rimbalzo-muro'
  | 'tocco-giocatore';
```

Sostituisci `completaConValutazione` con una funzione che calcola la valutazione finale
internamente invece di riceverla come parametro. Riceve i punti rilevanti come
parametri espliciti (non li legge dallo state React) perché verrà chiamata dallo stesso
handler che ha appena chiamato `setDestinazione`, il cui aggiornamento di stato non è
ancora visibile in modo sincrono nello stesso giro di funzione:

```ts
function completa(puntoDestinazione: Punto, puntoTocco: Punto | null, giocatoreToccoId: string | null) {
  const valutazioneMuroTocco = puntoTocco !== null
    ? (derivaValutazioneMuro(squadraBloccante!, puntoDestinazione) ?? '+')
    : null;
  const valutazioneFinale = fondamentale === 'muro'
    ? (derivaValutazioneMuro(squadra!, puntoDestinazione) ?? '+')
    : (derivaValutazioneAttaccoCerta(puntoTocco !== null, valutazioneMuroTocco) ?? '+');

  const dati: DatiAttaccoMuro = {
    fondamentale,
    squadra: squadra!,
    giocatoreId: giocatoreId!,
    valutazione: valutazioneFinale,
    origine: origine!,
    destinazione: puntoDestinazione,
    toccoMuro: puntoTocco !== null,
  };
  if (puntoTocco !== null) {
    onCompleta(dati, { giocatoreId: giocatoreToccoId!, valutazione: valutazioneMuroTocco!, origine: puntoTocco });
  } else {
    onCompleta(dati);
  }
}
```

Rimuovi lo state `toccoValutazione` (non più necessario: la valutazione del tocco si
calcola dentro `completa()` da `derivaValutazioneMuro`, non viene più raccolta con un
tap) — rimuovi anche il suo `useState` in cima al componente.

Con questa firma, i punti in cui `completa` viene chiamata sono:

- Nel ramo `destinazione`/`rimbalzo-muro` (attacco/muro senza tocco, o muro diretto): `completa(p, null, null)`.
- Nel ramo `tocco-giocatore` (dopo aver scelto chi ha toccato): `completa(destinazione!, toccoOrigine!, id)` — qui `destinazione` (il rimbalzo dopo il tocco, già in state da uno step precedente) e `toccoOrigine` sono già stabili nello state al momento del tap sul giocatore, quindi leggerli da state è sicuro in questo punto.

Riscrivi per intero il blocco `modalita` così:

```ts
const modalita = (() => {
  if (passo === 'giocatore') {
    return {
      tipo: 'seleziona-giocatore-entrambe' as const,
      onSeleziona: (id: string, sq: Squadra) => {
        setGiocatoreId(id);
        setSquadra(sq);
        setPasso('origine');
      },
    };
  }
  if (passo === 'origine') {
    return {
      tipo: 'seleziona-punto' as const,
      onSeleziona: (p: Punto) => {
        setOrigine(p);
        setPasso('destinazione');
      },
    };
  }
  if (passo === 'destinazione' && fondamentale === 'attacco') {
    return {
      tipo: 'seleziona-punto-con-fascia-muro' as const,
      squadraAttaccante: squadra!,
      onSelezionaPunto: (p: Punto) => {
        setDestinazione(p);
        completa(p, null, null);
      },
      onSelezionaMuro: (p: Punto) => {
        setToccoOrigine(p);
        setPasso('rimbalzo-muro');
      },
    };
  }
  if (passo === 'destinazione') {
    return {
      tipo: 'seleziona-punto' as const,
      onSeleziona: (p: Punto) => {
        setDestinazione(p);
        completa(p, null, null);
      },
    };
  }
  if (passo === 'rimbalzo-muro') {
    return {
      tipo: 'seleziona-punto' as const,
      onSeleziona: (p: Punto) => {
        setDestinazione(p);
        setPasso('tocco-giocatore');
      },
    };
  }
  if (passo === 'tocco-giocatore' && squadraBloccante) {
    return {
      tipo: 'seleziona-giocatore-prima-linea' as const,
      squadraAttiva: squadraBloccante,
      onSeleziona: (id: string) => {
        completa(destinazione!, toccoOrigine!, id);
      },
    };
  }
  return { tipo: 'inattivo' as const };
})();
```

Nota: `setToccoGiocatoreId`/`toccoGiocatoreId` non servono più come state separato (il valore passa direttamente da `onSeleziona` a `completa`) — rimuovi anche quello `useState`.

Semplifica `controlli`: rimuovi i rami `if (passo === 'tocco-valutazione')` e `if (passo === 'valutazione')`; l'etichetta generica in fondo copre già tutti i passi rimanenti (verifica che la lista `passo === 'tocco-giocatore' ? ... : 'la destinazione'` in fondo resti corretta per i passi superstiti).

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/features/live-scouting/AttaccoMuroFlow.test.tsx`
Expected: PASS, tutti e quattro i test.

- [ ] **Step 5: tsc + suite completa + commit**

Run: `npx tsc -b && npx vitest run`
Expected: nessun errore. Se `tsc` segnala `toccoGiocatoreId`/`toccoValutazione` dichiarati ma mai letti, conferma di averli rimossi entrambi dal componente (state e ogni riferimento).

```bash
git add src/features/live-scouting/AttaccoMuroFlow.tsx src/features/live-scouting/AttaccoMuroFlow.test.tsx
git commit -m "feat: deriva automaticamente la valutazione di attacco/muro/tocco muro"
```

---

## Task 7: Store — correzione post-hoc della valutazione

**Files:**
- Modify: `src/db/scouting.ts`
- Modify: `src/db/scouting.test.ts`
- Modify: `src/store/liveMatchStore.ts`
- Modify: `src/store/liveMatchStore.test.ts`

**Interfaces:**
- Produces:
  - `aggiornaValutazioneAzione(id: string, valutazione: Valutazione): Promise<void>` in `db/scouting.ts`.
  - `correggiValutazione: (azioneId: string, nuovaValutazione: Valutazione) => Promise<void>` nello store `useLiveMatchStore`.

- [ ] **Step 1: Scrivi il test fallito per `aggiornaValutazioneAzione`**

In `src/db/scouting.test.ts`, aggiungi (segui lo stile degli altri test del file, che già importano `supabase` da `@/lib/supabase` per verificare lo stato dopo l'operazione):

```ts
it('aggiorna la valutazione di unazione esistente', async () => {
  await salvaRally(creaRally());
  await salvaAzione(creaAzione({ valutazione: '+' }));
  await aggiornaValutazioneAzione('az1', '#');
  const { data: aggiornata } = await supabase.from('azioni').select('*').eq('id', 'az1').maybeSingle();
  expect(aggiornata?.valutazione).toBe('#');
});
```

Aggiorna l'import in cima al file per includere `aggiornaValutazioneAzione`.

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/db/scouting.test.ts`
Expected: FAIL — `aggiornaValutazioneAzione` non esiste.

- [ ] **Step 3: Implementa `aggiornaValutazioneAzione`**

In `src/db/scouting.ts`, aggiungi dopo `salvaAzione`:

```ts
export async function aggiornaValutazioneAzione(id: string, valutazione: Azione['valutazione']): Promise<void> {
  const { error } = await supabase.from('azioni').update({ valutazione }).eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/db/scouting.test.ts`
Expected: PASS.

- [ ] **Step 5: Scrivi il test fallito per `correggiValutazione` nello store**

In `src/store/liveMatchStore.test.ts`, aggiungi (usa lo stesso pattern di setup del `beforeEach` già presente nel file, che carica un set di test):

```ts
it('corregge la valutazione di unazione esistente e il punteggio derivato si aggiorna di conseguenza', async () => {
  await useLiveMatchStore.getState().registraAzione({
    squadra: 'A', giocatoreId: 'a7', fondamentale: 'attacco', tipoBattuta: null,
    valutazione: '+', origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
  });
  const azioneId = useLiveMatchStore.getState().azioni[0].id;

  await useLiveMatchStore.getState().correggiValutazione(azioneId, '#');

  const azioneCorretta = useLiveMatchStore.getState().azioni.find((a) => a.id === azioneId);
  expect(azioneCorretta?.valutazione).toBe('#');
  const stato = useLiveMatchStore.getState().statoDerivato();
  expect(stato.punteggioA).toBe(1);
});
```

- [ ] **Step 6: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/store/liveMatchStore.test.ts`
Expected: FAIL — `correggiValutazione` non esiste sullo store (errore di tipo/runtime).

- [ ] **Step 7: Implementa `correggiValutazione` nello store**

In `src/store/liveMatchStore.ts`:

Aggiorna l'import da `@/db/scouting`:

```ts
import {
  salvaRally,
  aggiornaRallyEsito,
  salvaAzione,
  aggiornaValutazioneAzione,
  eliminaAzione,
  eliminaRallySeVuoto,
  salvaSostituzione,
  salvaTimeout,
} from '@/db/scouting';
```

Aggiungi alla firma dell'interfaccia `LiveMatchState`:

```ts
correggiValutazione: (azioneId: string, nuovaValutazione: Azione['valutazione']) => Promise<void>;
```

Aggiungi l'implementazione nell'oggetto dello store, dopo `annullaUltimaAzione`:

```ts
correggiValutazione: async (azioneId, nuovaValutazione) => {
  await aggiornaValutazioneAzione(azioneId, nuovaValutazione);
  set((s) => ({
    azioni: s.azioni.map((a) => (a.id === azioneId ? { ...a, valutazione: nuovaValutazione } : a)),
  }));
},
```

- [ ] **Step 8: Esegui il test e verifica che passi**

Run: `npx vitest run src/store/liveMatchStore.test.ts`
Expected: PASS.

- [ ] **Step 9: tsc + suite completa + commit**

Run: `npx tsc -b && npx vitest run`
Expected: nessun errore.

```bash
git add src/db/scouting.ts src/db/scouting.test.ts src/store/liveMatchStore.ts src/store/liveMatchStore.test.ts
git commit -m "feat: aggiunge la correzione post-hoc della valutazione di unazione (store + db)"
```

---

## Task 8: Componente `StrisciaUltimaAzione`

**Files:**
- Create: `src/features/live-scouting/StrisciaUltimaAzione.tsx`
- Test: `src/features/live-scouting/StrisciaUltimaAzione.test.tsx`

**Interfaces:**
- Consumes: `Azione`, `Valutazione` da `@/domain/types`.
- Produces: `StrisciaUltimaAzione({ azione: Azione; onCorreggi: (v: Valutazione) => void })`, componente React con `data-testid="striscia-ultima-azione"` e bottoni `data-testid="correggi-valutazione-{simbolo}"` per ciascun simbolo diverso da quello corrente.

- [ ] **Step 1: Scrivi il test fallito**

Crea `src/features/live-scouting/StrisciaUltimaAzione.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrisciaUltimaAzione } from './StrisciaUltimaAzione';
import type { Azione } from '@/domain/types';

const azione: Azione = {
  id: 'az1', rallyId: 'r1', setId: 's1', ordine: 1, squadra: 'A', giocatoreId: 'a7',
  fondamentale: 'attacco', tipoBattuta: null, valutazione: '+',
  origine: { x: 30, y: 30 }, destinazione: { x: 70, y: 60 }, toccoMuro: false,
  timestamp: '2026-09-22T10:00:00.000Z',
};

describe('StrisciaUltimaAzione', () => {
  it('mostra fondamentale, giocatore e valutazione applicata', () => {
    render(<StrisciaUltimaAzione azione={azione} onCorreggi={vi.fn()} />);
    const striscia = screen.getByTestId('striscia-ultima-azione');
    expect(striscia).toHaveTextContent('attacco');
    expect(striscia).toHaveTextContent('a7');
    expect(striscia).toHaveTextContent('+');
  });

  it('mostra un bottone di correzione per ogni valutazione diversa da quella applicata, e chiama onCorreggi al tap', async () => {
    const onCorreggi = vi.fn();
    const user = userEvent.setup();
    render(<StrisciaUltimaAzione azione={azione} onCorreggi={onCorreggi} />);

    expect(screen.queryByTestId('correggi-valutazione-+')).not.toBeInTheDocument();
    expect(screen.getAllByTestId(/correggi-valutazione-/)).toHaveLength(5);

    await user.click(screen.getByTestId('correggi-valutazione-#'));
    expect(onCorreggi).toHaveBeenCalledWith('#');
  });
});
```

- [ ] **Step 2: Esegui il test e verifica che fallisca**

Run: `npx vitest run src/features/live-scouting/StrisciaUltimaAzione.test.tsx`
Expected: FAIL — il modulo non esiste.

- [ ] **Step 3: Implementa il componente**

Crea `src/features/live-scouting/StrisciaUltimaAzione.tsx`:

```tsx
import type { Azione, Valutazione } from '@/domain/types';

const TUTTE_LE_VALUTAZIONI: Valutazione[] = ['#', '+', '!', '-', '/', '='];

export function StrisciaUltimaAzione({
  azione,
  onCorreggi,
}: {
  azione: Azione;
  onCorreggi: (valutazione: Valutazione) => void;
}) {
  const alternative = TUTTE_LE_VALUTAZIONI.filter((v) => v !== azione.valutazione);

  return (
    <div
      data-testid="striscia-ultima-azione"
      className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
    >
      <span className="text-slate-300">
        {azione.fondamentale} {azione.giocatoreId ? `#${azione.giocatoreId}` : ''}: <strong>{azione.valutazione}</strong>
      </span>
      <div className="flex gap-1">
        {alternative.map((v) => (
          <button
            key={v}
            type="button"
            data-testid={`correggi-valutazione-${v}`}
            onClick={() => onCorreggi(v)}
            className="h-8 w-8 rounded-full bg-slate-700 text-sm font-bold text-white active:bg-slate-500"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Esegui il test e verifica che passi**

Run: `npx vitest run src/features/live-scouting/StrisciaUltimaAzione.test.tsx`
Expected: PASS.

- [ ] **Step 5: tsc + suite completa + commit**

Run: `npx tsc -b && npx vitest run`
Expected: nessun errore.

```bash
git add src/features/live-scouting/StrisciaUltimaAzione.tsx src/features/live-scouting/StrisciaUltimaAzione.test.tsx
git commit -m "feat: aggiunge il componente StrisciaUltimaAzione per la correzione post-hoc"
```

---

## Task 9: Colori traiettoria (nero/verde/rosso)

**Files:**
- Modify: `src/components/CampoDaGioco.tsx`
- Modify: `src/components/CampoDaGioco.test.tsx`

**Interfaces:**
- Produces: `Traiettoria` con campo obbligatorio `esito: 'punto_esecutore' | 'continua' | 'punto_avversario'`.

- [ ] **Step 1: Aggiorna il test esistente e scrivi i nuovi test falliti**

In `src/components/CampoDaGioco.test.tsx`, il test esistente `'disegna la traiettoria dellultima azione quando fornita'` deve passare `esito` (altrimenti non compila più, dato che diventa un campo obbligatorio dell'interfaccia):

```ts
it('disegna la traiettoria dellultima azione quando fornita, colorata di verde se il rally continua', () => {
  render(
    <CampoDaGioco
      inCampoA={giocatoriA}
      inCampoB={giocatoriB}
      modalita={{ tipo: 'inattivo' }}
      ultimaTraiettoria={{ origine: { x: 10, y: 20 }, destinazione: { x: 80, y: 60 }, esito: 'continua' }}
    />,
  );
  const traiettoria = screen.getByTestId('ultima-traiettoria');
  expect(traiettoria.querySelector('line')).toHaveAttribute('x1', '10');
  expect(traiettoria.querySelector('line')).toHaveAttribute('y1', '10');
  expect(traiettoria.querySelector('line')).toHaveAttribute('y2', '30');
  expect(traiettoria.querySelector('line')).toHaveAttribute('stroke', '#22c55e');
});

it('colora la traiettoria di nero quando lazione fa punto per chi lha eseguita', () => {
  render(
    <CampoDaGioco
      inCampoA={giocatoriA}
      inCampoB={giocatoriB}
      modalita={{ tipo: 'inattivo' }}
      ultimaTraiettoria={{ origine: { x: 10, y: 20 }, destinazione: { x: 80, y: 60 }, esito: 'punto_esecutore' }}
    />,
  );
  expect(screen.getByTestId('ultima-traiettoria').querySelector('line')).toHaveAttribute('stroke', '#000000');
});

it('colora la traiettoria di rosso quando lazione fa punto per la squadra avversaria', () => {
  render(
    <CampoDaGioco
      inCampoA={giocatoriA}
      inCampoB={giocatoriB}
      modalita={{ tipo: 'inattivo' }}
      ultimaTraiettoria={{ origine: { x: 10, y: 20 }, destinazione: { x: 80, y: 60 }, esito: 'punto_avversario' }}
    />,
  );
  expect(screen.getByTestId('ultima-traiettoria').querySelector('line')).toHaveAttribute('stroke', '#ef4444');
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npx vitest run src/components/CampoDaGioco.test.tsx`
Expected: FAIL — `stroke` è ancora sempre `"white"`, e il primo test fallisce comunque a livello di tipi TypeScript finché `esito` non è nell'interfaccia (se il progetto esegue `tsc` separatamente dai test, l'errore di tipo emerge lì; a runtime con Vitest+esbuild i tipi non bloccano l'esecuzione, ma l'asserzione sul colore comunque fallisce).

- [ ] **Step 3: Aggiorna `Traiettoria` e il rendering in `CampoDaGioco.tsx`**

Aggiorna l'interfaccia:

```ts
export interface Traiettoria {
  origine: Punto;
  destinazione: Punto;
  esito: 'punto_esecutore' | 'continua' | 'punto_avversario';
}
```

Aggiungi la mappa colori subito dopo `COLORI_SQUADRA`:

```ts
const COLORE_ESITO: Record<Traiettoria['esito'], string> = {
  punto_esecutore: '#000000',
  continua: '#22c55e',
  punto_avversario: '#ef4444',
};
```

Aggiorna il blocco di rendering della traiettoria:

```tsx
{ultimaTraiettoria && (
  <g data-testid="ultima-traiettoria" opacity={0.6}>
    <line
      x1={ultimaTraiettoria.origine.x}
      y1={vy(ultimaTraiettoria.origine.y)}
      x2={ultimaTraiettoria.destinazione.x}
      y2={vy(ultimaTraiettoria.destinazione.y)}
      stroke={COLORE_ESITO[ultimaTraiettoria.esito]}
      strokeWidth={0.6}
      strokeDasharray="2,1.5"
    />
    <circle cx={ultimaTraiettoria.origine.x} cy={vy(ultimaTraiettoria.origine.y)} r={1.2} fill={COLORE_ESITO[ultimaTraiettoria.esito]} />
    <circle cx={ultimaTraiettoria.destinazione.x} cy={vy(ultimaTraiettoria.destinazione.y)} r={1.8} fill={COLORE_ESITO[ultimaTraiettoria.esito]} />
  </g>
)}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npx vitest run src/components/CampoDaGioco.test.tsx`
Expected: PASS, tutti i test del file.

- [ ] **Step 5: tsc + commit**

Run: `npx tsc -b`
Expected: FALLISCE ancora, perché ogni chiamante che costruisce un `Traiettoria` (in `LiveScoutingScreen.tsx`) non passa `esito` — questo è atteso, si risolve nel Task 10. Non fare commit di questo task da solo se `tsc -b` non passa sull'intero progetto: verifica con `npx tsc -b --noEmit src/components/CampoDaGioco.tsx` (compilazione isolata del file) se il tuo ambiente lo supporta, altrimenti procedi comunque al commit di questo task (i test del componente passano in isolamento) e correggi `tsc -b` a fine Task 10 — annota nel messaggio di commit che `tsc -b` sull'intero progetto fallirà fino al task successivo.

```bash
git add src/components/CampoDaGioco.tsx src/components/CampoDaGioco.test.tsx
git commit -m "feat: colora la traiettoria in base allesito (nero punto, verde continua, rosso punto avversario)

tsc -b sull'intero progetto fallisce fino al prossimo commit: LiveScoutingScreen.tsx
non passa ancora 'esito' quando costruisce un Traiettoria (task successivo)."
```

---

## Task 10: Wiring in `LiveScoutingScreen.tsx` — striscia + colore traiettoria + aggiornamento test

**Files:**
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx`

**Interfaces:**
- Consumes: `StrisciaUltimaAzione` (Task 8), `correggiValutazione` dallo store (Task 7), `determinaEsitoAutomatico` da `@/domain/reducer` (già esportato).

- [ ] **Step 1: Aggiorna il calcolo di `ultimaTraiettoria` e aggiungi la striscia**

In `src/features/live-scouting/LiveScoutingScreen.tsx`:

Aggiorna l'import di `reducer`:

```ts
import { squadraOpposta, determinaEsitoAutomatico } from '@/domain/reducer';
```

Aggiungi l'import del nuovo componente e dell'azione dello store:

```ts
import { StrisciaUltimaAzione } from './StrisciaUltimaAzione';
```

Aggiungi la selezione dell'azione `correggiValutazione` dallo store, vicino alle altre (dopo `aggiungiTimeout`):

```ts
const correggiValutazione = useLiveMatchStore((s) => s.correggiValutazione);
```

Sostituisci il calcolo di `ultimaTraiettoria` (righe 131-134 circa):

```ts
const ultimaAzioneConTraiettoria = [...azioni].reverse().find((a) => a.origine && a.destinazione);
const esitoUltimaTraiettoria = ultimaAzioneConTraiettoria
  ? determinaEsitoAutomatico([ultimaAzioneConTraiettoria])
  : null;
const ultimaTraiettoria = ultimaAzioneConTraiettoria
  ? {
      origine: ultimaAzioneConTraiettoria.origine!,
      destinazione: ultimaAzioneConTraiettoria.destinazione!,
      esito: (esitoUltimaTraiettoria === null
        ? 'continua'
        : esitoUltimaTraiettoria === (ultimaAzioneConTraiettoria.squadra === 'A' ? 'punto_A' : 'punto_B')
          ? 'punto_esecutore'
          : 'punto_avversario') as 'punto_esecutore' | 'continua' | 'punto_avversario',
    }
  : null;
```

Aggiungi il rendering della striscia subito sotto l'ultimo `azioni.length > 0` significativo del JSX — cerca dove il layout mostra la sezione sotto il campo (indicativamente vicino a dove sono renderizzati i tre flussi `BattutaFlow`/`RicezioneFlow`/`AttaccoMuroFlow`, fuori dal loro blocco condizionale, così resta visibile a prescindere da quale flusso è attivo) e aggiungi:

```tsx
{azioni.length > 0 && (
  <StrisciaUltimaAzione
    azione={azioni[azioni.length - 1]}
    onCorreggi={(v) => correggiValutazione(azioni[azioni.length - 1].id, v)}
  />
)}
```

- [ ] **Step 2: Esegui tsc sull'intero progetto**

Run: `npx tsc -b`
Expected: PASS (questo risolve il fallimento lasciato in sospeso dal Task 9).

- [ ] **Step 3: Aggiorna `registraAcePerSquadraAlServizio` in `LiveScoutingScreen.test.tsx`**

Il vecchio helper chiudeva il rally cliccando `'='` sul bottone di valutazione della ricezione — quel bottone non esiste più (la ricezione è auto-derivata, e la derivazione geometrica non produce mai `'='`). Il nuovo modo di ottenere lo stesso risultato (ace via percorso ricezione, non via bottone diretto "Ace #") è: far cadere la ricezione in una zona che si deriva geometricamente a un valore qualsiasi diverso da `'='` (il rally resta aperto), poi correggerla a `'='` con la striscia (che chiude il rally). Sostituisci l'intera funzione in cima al file:

```ts
async function registraAcePerSquadraAlServizio(
  user: ReturnType<typeof userEvent.setup>,
  giocatoreRicevente: { id: string },
) {
  await screen.findByText('Flottante');
  await user.click(screen.getByText('Flottante'));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });

  const markerRicevente = `giocatore-campo-${giocatoreRicevente.id}`;
  await waitFor(() => expect(screen.getByTestId(markerRicevente)).toHaveAttribute('data-attivo', 'true'));
  await user.click(screen.getByTestId(markerRicevente));
  fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 55, clientY: 50 });

  await user.click(screen.getByTestId('correggi-valutazione-='));
}
```

**Nota:** il tap `{clientX:55, clientY:50}` con `squadraRicevente` pari alla squadra che riceve (dedotta dal contesto del test — verifica quale squadra riceve in ciascun test chiamante, di solito B) deriva geometricamente una valutazione diversa da `'='` (qualunque banda tra `#` e `/`), quindi il bottone `correggi-valutazione-=` esiste sempre nella striscia subito dopo (la striscia esclude solo il valore già applicato, mai `'='` a meno che non sia già quello). Non serve calcolare esattamente quale valore viene derivato: basta che non sia `'='`, garantito dal fatto che `derivaValutazioneRicezione` non ritorna mai `'='`.

- [ ] **Step 4: Esegui la suite di `LiveScoutingScreen.test.tsx` e correggi eventuali altri riferimenti a bottoni di valutazione rimossi**

Run: `npx vitest run src/features/live-scouting/LiveScoutingScreen.test.tsx`

Se emergono altri fallimenti in test che non passano per `registraAcePerSquadraAlServizio` ma cliccano comunque bottoni di valutazione ormai rimossi (es. test di sostituzione o chiusura set che nel frattempo registrano un attacco/muro con tap espliciti su valutazione), applica lo stesso principio: rimuovi il tap sul bottone di valutazione, lascia che il flusso completi con il valore derivato/default, e se il test dipende da un valore specifico per chiudere il rally, aggiungi un tap su `correggi-valutazione-{simbolo-desiderato}` subito dopo.

Expected: PASS su tutti i test del file dopo le correzioni.

- [ ] **Step 5: Esegui l'intera suite**

Run: `npx vitest run`
Expected: PASS su tutti i file.

- [ ] **Step 6: tsc + build + commit**

Run: `npx tsc -b && npx vitest run && npm run build`
Expected: tutto verde, build di produzione senza errori.

```bash
git add src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: collega la striscia di correzione e i colori traiettoria in LiveScoutingScreen"
```

---

## Task 11: Verifica finale e nota sui rischi

**Files:** nessuno (solo verifica).

- [ ] **Step 1: Suite completa, tsc, build**

Run: `npx tsc -b && npx vitest run && npm run build`
Expected: tutto verde.

- [ ] **Step 2: Verifica manuale dal vivo (non automatizzabile in questo piano)**

Avvia il server di sviluppo (`npm run dev`) e prova dal vivo un rally completo (battuta→ricezione→attacco→muro) controllando che:
- Nessun bottone di valutazione appaia più per ricezione/attacco/muro.
- La striscia "ultima azione" mostri il valore derivato e permetta di correggerlo con un tap.
- Le soglie di `derivaValutazioneRicezione`/`derivaValutazioneMuro` (sezione "Rischi" dello spec) diano risultati ragionevoli con tap reali — se sembrano sbagliate, sono costanti isolate in `domain/valutazioneAutomatica.ts`, facili da ritoccare in un secondo momento senza toccare i flussi.

Questo step è manuale, non ha un comando da eseguire: annota all'utente cosa hai osservato prima di considerare il lavoro concluso.

- [ ] **Step 3: Commit finale (se necessario)**

Se lo step 2 porta a piccoli aggiustamenti delle soglie, applica le modifiche a `src/domain/valutazioneAutomatica.ts` e ai relativi test, poi:

```bash
git add -A
git commit -m "fix: taratura soglie di derivazione automatica dopo verifica dal vivo"
```

Se nessun aggiustamento è necessario, non fare commit vuoti.
