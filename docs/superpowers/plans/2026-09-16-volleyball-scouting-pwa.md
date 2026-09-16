# PWA Scouting Pallavolo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Costruire la v1 della PWA di scouting live pallavolo per iPad: gestione squadre, setup partita, scouting punto-per-punto offline con motore a event-sourcing, statistiche/analisi live, storico ed export CSV/PDF.

**Architecture:** React + TypeScript + Vite, storage locale Dexie (IndexedDB), motore di dominio puro a event-sourcing (`domain/`) che deriva punteggio/rotazione/statistiche rifacendo il replay della sequenza di `Rally`+`Azione`, Zustand per lo stato della partita in corso, `vite-plugin-pwa` per l'offline.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Dexie 4 + dexie-react-hooks, Zustand, react-router-dom 6, uuid, Vitest + Testing Library, vite-plugin-pwa, jsPDF (solo per l'export PDF, task finale).

**Spec:** `docs/superpowers/specs/2026-09-16-volleyball-scouting-pwa-design.md`

## Global Constraints

- Nessun backend, nessun account utente: tutto lo storage è locale via Dexie (IndexedDB).
- App offline-first: deve funzionare a freddo dopo la prima installazione (service worker precache).
- UI touch-first, target grandi, nessuna interazione hover-dependent, layout pensato per iPad in landscape.
- Terminologia italiana in tutta la UI (Battuta, Ricezione, Attacco, Muro, ecc.).
- Nessun dato derivato (punteggio, rotazione, statistiche) va mai salvato in Dexie: si ricalcola sempre da `Rally`+`Azione` (event sourcing), vedi spec sezione "Motore di replay".
- Fondamentali tracciati: solo `battuta`, `ricezione`, `attacco`, `muro`. Difesa e alzata non sono azioni loggate.
- Formula efficienza standard per tutti i fondamentali: `(# - =) / totale × 100`.
- Griglia zona origine: 6 celle, disposizione `4-3-2` (avanti) / `5-6-1` (dietro). Griglia direzione destinazione: 9 celle, `7-8-9` (corto) / `4-3-2` (medio) / `5-6-1` (profondo).
- Le funzioni in `domain/` sono TypeScript puro, senza dipendenze da React o Zustand, e vanno testate in isolamento.

---

### Task 1: Scaffold del progetto (Vite + React + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/app/router.tsx`, `vitest.setup.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: alias `@/*` → `src/*` (usato da tutti i task successivi negli import), `router` esportato da `src/app/router.tsx` come `createBrowserRouter`.

- [ ] **Step 1: Crea `package.json`**

```json
{
  "name": "scouting-pallavolo",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "dexie": "^4.0.8",
    "dexie-react-hooks": "^1.1.7",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.0",
    "uuid": "^10.0.0",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.4",
    "vite": "^5.4.3",
    "vite-plugin-pwa": "^0.20.1",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Crea `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
  },
});
```

- [ ] **Step 3: Crea `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Crea `tailwind.config.ts` e `postcss.config.js`**

```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

```js
// postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Crea `index.html`, `src/index.css`, `src/main.tsx`**

```html
<!-- index.html -->
<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Scouting Pallavolo</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```css
/* src/index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

```tsx
// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 6: Crea `src/app/router.tsx` e `src/App.tsx`**

```tsx
// src/app/router.tsx
import { createBrowserRouter } from 'react-router-dom';

function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <h1 className="text-3xl font-bold">Scouting Pallavolo</h1>
    </main>
  );
}

export const router = createBrowserRouter([{ path: '/', element: <HomePage /> }]);
```

```tsx
// src/App.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';

export default function App() {
  return <RouterProvider router={router} />;
}
```

- [ ] **Step 7: Crea `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Scrivi il test di fumo `src/App.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('mostra il titolo della home', () => {
    render(<App />);
    expect(screen.getByText('Scouting Pallavolo')).toBeInTheDocument();
  });
});
```

- [ ] **Step 9: Installa le dipendenze ed esegui i test**

Run: `npm install && npm test`
Expected: PASS — 1 test superato.

- [ ] **Step 10: Commit**

```bash
git add package.json vite.config.ts tsconfig.json tailwind.config.ts postcss.config.js index.html src vitest.setup.ts package-lock.json
git commit -m "chore: scaffold vite react ts project with tailwind and vitest"
```

### Task 2: Configurazione PWA (manifest, icone, service worker)

**Files:**
- Modify: `vite.config.ts`
- Create: `public/icon-source.svg`, `pwa-assets.config.ts`
- Modify: `package.json` (script `pwa:icons`)

**Interfaces:**
- Consumes: `defineConfig` da `vite.config.ts` (Task 1).
- Produces: manifest PWA con icone in `public/` (`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon-180x180.png`, `maskable-icon-512x512.png`, `favicon.ico`), service worker `generateSW`.

- [ ] **Step 1: Installa le dipendenze necessarie**

Run: `npm install -D @vite-pwa/assets-generator`
Expected: pacchetto aggiunto a `devDependencies`.

- [ ] **Step 2: Crea l'icona sorgente `public/icon-source.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <circle cx="256" cy="256" r="176" fill="none" stroke="#f8fafc" stroke-width="24"/>
  <path d="M100 210c120 40 220 40 312 0" fill="none" stroke="#f8fafc" stroke-width="16"/>
  <path d="M140 380c60-80 60-180 0-280" fill="none" stroke="#f8fafc" stroke-width="16"/>
  <text x="256" y="470" text-anchor="middle" font-family="sans-serif" font-size="48" fill="#f8fafc">SP</text>
</svg>
```

- [ ] **Step 3: Crea `pwa-assets.config.ts`**

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/icon-source.svg'],
});
```

- [ ] **Step 4: Aggiungi lo script di generazione in `package.json`**

```json
"scripts": {
  "pwa:icons": "pwa-assets-generator"
}
```

(aggiungere alla sezione `scripts` esistente creata nel Task 1)

- [ ] **Step 5: Genera le icone**

Run: `npm run pwa:icons`
Expected: file PNG generati in `public/` (`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon-180x180.png`, `maskable-icon-512x512.png`, `favicon.ico`).

- [ ] **Step 6: Configura `VitePWA` in `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'Scouting Pallavolo',
        short_name: 'Scouting',
        description: 'Scouting live pallavolo offline per iPad',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    globals: true,
  },
});
```

- [ ] **Step 7: Aggiungi il tag apple-touch-icon in `index.html`**

Aggiungi dentro `<head>`, dopo il `<meta viewport>`:

```html
<link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
```

- [ ] **Step 8: Verifica la build**

Run: `npm run build`
Expected: build completata senza errori, `dist/manifest.webmanifest` e `dist/sw.js` generati.

- [ ] **Step 9: Commit**

```bash
git add vite.config.ts index.html package.json package-lock.json public pwa-assets.config.ts
git commit -m "feat: configure PWA manifest, icons and service worker"
```

### Task 3: Tipi di dominio e schema Dexie

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/db/schema.ts`
- Test: `src/db/schema.test.ts`

**Interfaces:**
- Produces: tipi `Team`, `Player`, `Match`, `SetPallavolo`, `Rally`, `Azione`, `Sostituzione`, `Timeout`, `Fondamentale`, `TipoBattuta`, `Valutazione`, `Squadra` da `@/domain/types` (usati da tutti i task successivi); istanza `db` da `@/db/schema`.

- [ ] **Step 1: Crea `src/domain/types.ts`**

```ts
export type Squadra = 'A' | 'B';
export type Fondamentale = 'battuta' | 'ricezione' | 'attacco' | 'muro';
export type TipoBattuta = 'flottante' | 'salto_flottante' | 'salto_spin';
export type Valutazione = '#' | '+' | '!' | '-' | '=';
export type Ruolo = 'palleggiatore' | 'opposto' | 'schiacciatore' | 'centrale' | 'libero';

export interface Team {
  id: string;
  nome: string;
  createdAt: string;
}

export interface Player {
  id: string;
  teamId: string;
  numero: number;
  nome: string;
  ruolo: Ruolo;
  attivo: boolean;
}

export interface Match {
  id: string;
  data: string;
  squadraAId: string;
  squadraBId: string;
  squadraRiferimentoId: string | null;
  formatoSet: 3 | 5;
  puntiSet: number;
  puntiSetDecisivo: number;
  stato: 'in_corso' | 'conclusa';
  note?: string;
}

export interface SetPallavolo {
  id: string;
  matchId: string;
  numero: number;
  formazioneInizialeA: string[];
  formazioneInizialeB: string[];
  primaSquadraAlServizio: Squadra;
  stato: 'in_corso' | 'concluso';
  vincitore: Squadra | null;
}

export interface Rally {
  id: string;
  setId: string;
  numero: number;
  squadraAlServizio: Squadra;
  esito: 'punto_A' | 'punto_B' | null;
  chiusuraManuale: boolean;
}

export interface Azione {
  id: string;
  rallyId: string;
  setId: string;
  ordine: number;
  squadra: Squadra;
  giocatoreId: string | null;
  fondamentale: Fondamentale;
  tipoBattuta: TipoBattuta | null;
  valutazione: Valutazione;
  zona: number | null;
  direzione: number | null;
  timestamp: string;
}

export interface Sostituzione {
  id: string;
  setId: string;
  dopoRallyNumero: number;
  squadra: Squadra;
  giocatoreEsceId: string;
  giocatoreEntraId: string;
}

export interface Timeout {
  id: string;
  setId: string;
  dopoRallyNumero: number;
  squadra: Squadra;
}
```

- [ ] **Step 2: Crea `src/db/schema.ts`**

```ts
import Dexie, { type Table } from 'dexie';
import type {
  Team,
  Player,
  Match,
  SetPallavolo,
  Rally,
  Azione,
  Sostituzione,
  Timeout,
} from '@/domain/types';

export class ScoutingDatabase extends Dexie {
  teams!: Table<Team, string>;
  players!: Table<Player, string>;
  matches!: Table<Match, string>;
  sets!: Table<SetPallavolo, string>;
  rallies!: Table<Rally, string>;
  azioni!: Table<Azione, string>;
  sostituzioni!: Table<Sostituzione, string>;
  timeouts!: Table<Timeout, string>;

  constructor(name = 'scouting-pallavolo') {
    super(name);
    this.version(1).stores({
      teams: 'id, nome',
      players: 'id, teamId',
      matches: 'id, stato, data',
      sets: 'id, matchId',
      rallies: 'id, setId, [setId+numero]',
      azioni: 'id, rallyId, setId, [setId+giocatoreId], [rallyId+ordine]',
      sostituzioni: 'id, setId',
      timeouts: 'id, setId',
    });
  }
}

export const db = new ScoutingDatabase();
```

- [ ] **Step 3: Scrivi il test `src/db/schema.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ScoutingDatabase } from './schema';

describe('ScoutingDatabase', () => {
  let db: ScoutingDatabase;

  beforeEach(() => {
    db = new ScoutingDatabase(`test-db-${Math.random()}`);
  });

  it('salva e recupera una squadra', async () => {
    await db.teams.add({ id: 't1', nome: 'Volley Rossi', createdAt: new Date().toISOString() });
    const squadra = await db.teams.get('t1');
    expect(squadra?.nome).toBe('Volley Rossi');
  });

  it('trova i giocatori di una squadra tramite indice teamId', async () => {
    await db.players.bulkAdd([
      { id: 'p1', teamId: 't1', numero: 4, nome: 'Bianchi', ruolo: 'centrale', attivo: true },
      { id: 'p2', teamId: 't2', numero: 7, nome: 'Verdi', ruolo: 'libero', attivo: true },
    ]);
    const giocatori = await db.players.where('teamId').equals('t1').toArray();
    expect(giocatori).toHaveLength(1);
    expect(giocatori[0].nome).toBe('Bianchi');
  });
});
```

- [ ] **Step 4: Installa `fake-indexeddb` per far girare Dexie in Vitest**

Run: `npm install -D fake-indexeddb`

Aggiungi in cima a `vitest.setup.ts`:

```ts
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 5: Esegui i test**

Run: `npm test`
Expected: PASS — tutti i test superati, incluso il test di fumo del Task 1.

- [ ] **Step 6: Commit**

```bash
git add src/domain/types.ts src/db/schema.ts src/db/schema.test.ts vitest.setup.ts package.json package-lock.json
git commit -m "feat: add domain types and Dexie schema"
```

### Task 4: CRUD Squadre e Giocatori (`db/teams.ts`)

**Files:**
- Create: `src/db/teams.ts`
- Test: `src/db/teams.test.ts`

**Interfaces:**
- Consumes: `db` da `@/db/schema` (Task 3), tipi `Team`/`Player` da `@/domain/types` (Task 3).
- Produces: `creaSquadra`, `rinominaSquadra`, `eliminaSquadra`, `aggiungiGiocatore`, `modificaGiocatore`, `archiviaGiocatore` da `@/db/teams` (usati dai Task 11-12).

- [ ] **Step 1: Crea `src/db/teams.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';
import { db } from './schema';
import type { Player, Team } from '@/domain/types';

export async function creaSquadra(nome: string): Promise<Team> {
  const team: Team = { id: uuidv4(), nome, createdAt: new Date().toISOString() };
  await db.teams.add(team);
  return team;
}

export async function rinominaSquadra(id: string, nome: string): Promise<void> {
  await db.teams.update(id, { nome });
}

export async function eliminaSquadra(id: string): Promise<void> {
  await db.transaction('rw', db.teams, db.players, async () => {
    await db.players.where('teamId').equals(id).delete();
    await db.teams.delete(id);
  });
}

export async function aggiungiGiocatore(input: Omit<Player, 'id' | 'attivo'>): Promise<Player> {
  const player: Player = { ...input, id: uuidv4(), attivo: true };
  await db.players.add(player);
  return player;
}

export async function modificaGiocatore(
  id: string,
  modifiche: Partial<Omit<Player, 'id' | 'teamId'>>,
): Promise<void> {
  await db.players.update(id, modifiche);
}

export async function archiviaGiocatore(id: string): Promise<void> {
  await db.players.update(id, { attivo: false });
}
```

- [ ] **Step 2: Scrivi il test `src/db/teams.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { creaSquadra, rinominaSquadra, eliminaSquadra, aggiungiGiocatore, archiviaGiocatore } from './teams';

describe('db/teams', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
  });

  it('crea una squadra e la rinomina', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    await rinominaSquadra(squadra.id, 'Volley Rossi 2010');
    const aggiornata = await db.teams.get(squadra.id);
    expect(aggiornata?.nome).toBe('Volley Rossi 2010');
  });

  it('aggiunge un giocatore attivo di default', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const giocatore = await aggiungiGiocatore({
      teamId: squadra.id,
      numero: 9,
      nome: 'Neri',
      ruolo: 'opposto',
    });
    expect(giocatore.attivo).toBe(true);
  });

  it('archivia un giocatore senza eliminarlo', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const giocatore = await aggiungiGiocatore({
      teamId: squadra.id,
      numero: 9,
      nome: 'Neri',
      ruolo: 'opposto',
    });
    await archiviaGiocatore(giocatore.id);
    const aggiornato = await db.players.get(giocatore.id);
    expect(aggiornato?.attivo).toBe(false);
  });

  it('eliminando una squadra elimina anche i suoi giocatori', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    await aggiungiGiocatore({ teamId: squadra.id, numero: 9, nome: 'Neri', ruolo: 'opposto' });
    await eliminaSquadra(squadra.id);
    const giocatoriRimasti = await db.players.where('teamId').equals(squadra.id).toArray();
    expect(giocatoriRimasti).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/teams.ts src/db/teams.test.ts
git commit -m "feat: add team and player CRUD functions"
```

### Task 5: CRUD Partite e Set (`db/matches.ts`)

**Files:**
- Create: `src/db/matches.ts`
- Test: `src/db/matches.test.ts`

**Interfaces:**
- Consumes: `db` da `@/db/schema`, tipi `Match`/`SetPallavolo` da `@/domain/types`.
- Produces: `creaPartita`, `creaSet`, `aggiornaStatoSet`, `aggiornaStatoPartita` da `@/db/matches` (usati dai Task 13-14 e 26).

- [ ] **Step 1: Crea `src/db/matches.ts`**

```ts
import { v4 as uuidv4 } from 'uuid';
import { db } from './schema';
import type { Match, SetPallavolo } from '@/domain/types';

export async function creaPartita(input: Omit<Match, 'id' | 'stato'>): Promise<Match> {
  const match: Match = { ...input, id: uuidv4(), stato: 'in_corso' };
  await db.matches.add(match);
  return match;
}

export async function creaSet(
  input: Omit<SetPallavolo, 'id' | 'stato' | 'vincitore'>,
): Promise<SetPallavolo> {
  const set: SetPallavolo = { ...input, id: uuidv4(), stato: 'in_corso', vincitore: null };
  await db.sets.add(set);
  return set;
}

export async function aggiornaStatoSet(
  id: string,
  stato: SetPallavolo['stato'],
  vincitore: SetPallavolo['vincitore'],
): Promise<void> {
  await db.sets.update(id, { stato, vincitore });
}

export async function aggiornaStatoPartita(id: string, stato: Match['stato']): Promise<void> {
  await db.matches.update(id, { stato });
}
```

- [ ] **Step 2: Scrivi il test `src/db/matches.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import { creaPartita, creaSet, aggiornaStatoSet, aggiornaStatoPartita } from './matches';

describe('db/matches', () => {
  beforeEach(async () => {
    await db.matches.clear();
    await db.sets.clear();
  });

  it('crea una partita in corso con i punti set di default', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: 'sq-a',
      formatoSet: 5,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    expect(match.stato).toBe('in_corso');
  });

  it('crea un set con formazioni iniziali e lo chiude assegnando il vincitore', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: null,
      formatoSet: 3,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id,
      numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');
    const aggiornato = await db.sets.get(set.id);
    expect(aggiornato?.stato).toBe('concluso');
    expect(aggiornato?.vincitore).toBe('A');
  });

  it('conclude una partita', async () => {
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: 'sq-a',
      squadraBId: 'sq-b',
      squadraRiferimentoId: null,
      formatoSet: 3,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    await aggiornaStatoPartita(match.id, 'conclusa');
    const aggiornata = await db.matches.get(match.id);
    expect(aggiornata?.stato).toBe('conclusa');
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/matches.ts src/db/matches.test.ts
git commit -m "feat: add match and set CRUD functions"
```

### Task 6: Persistenza degli eventi di scouting (`db/scouting.ts`)

**Files:**
- Create: `src/db/scouting.ts`
- Test: `src/db/scouting.test.ts`

**Interfaces:**
- Consumes: `db` da `@/db/schema`, tipi `Rally`/`Azione`/`Sostituzione`/`Timeout` da `@/domain/types`.
- Produces: `salvaRally`, `aggiornaRallyEsito`, `salvaAzione`, `eliminaAzione`, `eliminaRallySeVuoto`, `salvaSostituzione`, `salvaTimeout`, `caricaDatiSet` da `@/db/scouting` (usati dal Task 15, lo store Zustand).

- [ ] **Step 1: Crea `src/db/scouting.ts`**

```ts
import { db } from './schema';
import type { Azione, Rally, Sostituzione, Timeout } from '@/domain/types';

export interface DatiSet {
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
}

export async function salvaRally(rally: Rally): Promise<void> {
  await db.rallies.add(rally);
}

export async function aggiornaRallyEsito(rally: Rally): Promise<void> {
  await db.rallies.put(rally);
}

export async function salvaAzione(azione: Azione): Promise<void> {
  await db.azioni.add(azione);
}

export async function eliminaAzione(id: string): Promise<void> {
  await db.azioni.delete(id);
}

export async function eliminaRallySeVuoto(rallyId: string): Promise<void> {
  const azioniRimaste = await db.azioni.where('rallyId').equals(rallyId).count();
  if (azioniRimaste === 0) {
    await db.rallies.delete(rallyId);
  }
}

export async function salvaSostituzione(sostituzione: Sostituzione): Promise<void> {
  await db.sostituzioni.add(sostituzione);
}

export async function salvaTimeout(timeout: Timeout): Promise<void> {
  await db.timeouts.add(timeout);
}

export async function caricaDatiSet(setId: string): Promise<DatiSet> {
  const [rallies, azioni, sostituzioni, timeouts] = await Promise.all([
    db.rallies.where('setId').equals(setId).sortBy('numero'),
    db.azioni.where('setId').equals(setId).toArray(),
    db.sostituzioni.where('setId').equals(setId).toArray(),
    db.timeouts.where('setId').equals(setId).toArray(),
  ]);
  azioni.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return { rallies, azioni, sostituzioni, timeouts };
}
```

- [ ] **Step 2: Scrivi il test `src/db/scouting.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './schema';
import {
  salvaRally,
  salvaAzione,
  eliminaAzione,
  eliminaRallySeVuoto,
  caricaDatiSet,
} from './scouting';
import type { Azione, Rally } from '@/domain/types';

function creaRally(overrides: Partial<Rally> = {}): Rally {
  return {
    id: 'r1',
    setId: 's1',
    numero: 1,
    squadraAlServizio: 'A',
    esito: null,
    chiusuraManuale: false,
    ...overrides,
  };
}

function creaAzione(overrides: Partial<Azione> = {}): Azione {
  return {
    id: 'az1',
    rallyId: 'r1',
    setId: 's1',
    ordine: 1,
    squadra: 'A',
    giocatoreId: 'p1',
    fondamentale: 'battuta',
    tipoBattuta: 'flottante',
    valutazione: '#',
    zona: 1,
    direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('db/scouting', () => {
  beforeEach(async () => {
    await db.rallies.clear();
    await db.azioni.clear();
  });

  it('carica rally e azioni di un set ordinati', async () => {
    await salvaRally(creaRally());
    await salvaAzione(creaAzione());
    const dati = await caricaDatiSet('s1');
    expect(dati.rallies).toHaveLength(1);
    expect(dati.azioni).toHaveLength(1);
  });

  it('elimina un rally solo se non ha più azioni', async () => {
    await salvaRally(creaRally());
    await salvaAzione(creaAzione());
    await eliminaRallySeVuoto('r1');
    const rallyAncoraPresente = await db.rallies.get('r1');
    expect(rallyAncoraPresente).toBeDefined();

    await eliminaAzione('az1');
    await eliminaRallySeVuoto('r1');
    const rallyEliminato = await db.rallies.get('r1');
    expect(rallyEliminato).toBeUndefined();
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/db/scouting.ts src/db/scouting.test.ts
git commit -m "feat: add scouting events persistence layer"
```

### Task 7: Rotazione (`domain/rotation.ts`)

**Files:**
- Create: `src/domain/rotation.ts`
- Test: `src/domain/rotation.test.ts`

**Interfaces:**
- Consumes: tipo `Sostituzione` da `@/domain/types`.
- Produces: `ruotaPosizioni(rotazione: string[]): string[]`, `applicaSostituzione(rotazione: string[], sostituzione: Sostituzione): string[]` (usate dal Task 8).

- [ ] **Step 1: Scrivi i test falliti `src/domain/rotation.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ruotaPosizioni, applicaSostituzione } from './rotation';
import type { Sostituzione } from './types';

describe('ruotaPosizioni', () => {
  it('sposta ogni giocatore di una posizione in senso orario (P2->P1, ..., P1->P6)', () => {
    const rotazione = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    expect(ruotaPosizioni(rotazione)).toEqual(['p2', 'p3', 'p4', 'p5', 'p6', 'p1']);
  });
});

describe('applicaSostituzione', () => {
  it('sostituisce solo il giocatore che esce, lasciando invariate le altre posizioni', () => {
    const rotazione = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const sostituzione: Sostituzione = {
      id: 's1',
      setId: 'set1',
      dopoRallyNumero: 3,
      squadra: 'A',
      giocatoreEsceId: 'p3',
      giocatoreEntraId: 'libero1',
    };
    expect(applicaSostituzione(rotazione, sostituzione)).toEqual([
      'p1', 'p2', 'libero1', 'p4', 'p5', 'p6',
    ]);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- rotation`
Expected: FAIL — `./rotation` non esiste ancora.

- [ ] **Step 3: Crea `src/domain/rotation.ts`**

```ts
import type { Sostituzione } from './types';

export function ruotaPosizioni(rotazione: string[]): string[] {
  return [...rotazione.slice(1), rotazione[0]];
}

export function applicaSostituzione(rotazione: string[], sostituzione: Sostituzione): string[] {
  return rotazione.map((giocatoreId) =>
    giocatoreId === sostituzione.giocatoreEsceId ? sostituzione.giocatoreEntraId : giocatoreId,
  );
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- rotation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/rotation.ts src/domain/rotation.test.ts
git commit -m "feat: add simplified rotation and substitution logic"
```

### Task 8: Motore di replay (`domain/reducer.ts`)

**Files:**
- Create: `src/domain/reducer.ts`
- Test: `src/domain/reducer.test.ts`

**Interfaces:**
- Consumes: `ruotaPosizioni`, `applicaSostituzione` da `@/domain/rotation` (Task 7); tipi `Azione`, `Rally`, `SetPallavolo`, `Sostituzione`, `Squadra` da `@/domain/types`.
- Produces: `deriveSetState(set, rallies, azioniPerRally, sostituzioni): SetStatoDerivato`, `determinaEsitoAutomatico(azioniRally: Azione[]): 'punto_A' | 'punto_B' | null` da `@/domain/reducer` (usate dal Task 15 store e dal Task 26 report).

- [ ] **Step 1: Scrivi i test falliti `src/domain/reducer.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { deriveSetState } from './reducer';
import type { Azione, Rally, SetPallavolo } from './types';

function creaSet(overrides: Partial<SetPallavolo> = {}): SetPallavolo {
  return {
    id: 'set1',
    matchId: 'match1',
    numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'A',
    stato: 'in_corso',
    vincitore: null,
    ...overrides,
  };
}

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az',
    rallyId: 'r1',
    setId: 'set1',
    ordine: 1,
    squadra: 'A',
    giocatoreId: 'a1',
    fondamentale: 'battuta',
    tipoBattuta: 'flottante',
    valutazione: '#',
    zona: 1,
    direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z',
    ...overrides,
  };
}

describe('deriveSetState', () => {
  it('assegna il punto al servizio su ace, senza ruotare', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '#' })]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(1);
    expect(stato.punteggioB).toBe(0);
    expect(stato.squadraAlServizio).toBe('A');
    expect(stato.rotazioneA).toEqual(['a1', 'a2', 'a3', 'a4', 'a5', 'a6']);
  });

  it('assegna il punto alla squadra ricevente su errore di battuta e ruota chi ha vinto', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '=' })]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(1);
    expect(stato.squadraAlServizio).toBe('B');
    expect(stato.rotazioneB).toEqual(['b2', 'b3', 'b4', 'b5', 'b6', 'b1']);
  });

  it('lascia il rally aperto se nessuna azione lo chiude (es. sola ricezione positiva)', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map([
      ['r1', [
        creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', fondamentale: 'battuta', valutazione: '+' }),
        creaAzione({ id: 'az2', rallyId: 'r1', squadra: 'B', fondamentale: 'ricezione', valutazione: '#', direzione: null }),
      ]],
    ]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(0);
    expect(stato.rallyApertoNumero).toBe(1);
  });

  it('rispetta la chiusura manuale ignorando le azioni presenti', () => {
    const rally: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: 'punto_B', chiusuraManuale: true };
    const azioni = new Map([['r1', [creaAzione({ id: 'az1', rallyId: 'r1', squadra: 'A', valutazione: '#' })]]]);
    const stato = deriveSetState(creaSet(), [rally], azioni, []);
    expect(stato.punteggioB).toBe(1);
    expect(stato.punteggioA).toBe(0);
  });

  it('applica una sostituzione prima del rally successivo alla sua registrazione', () => {
    const rally1: Rally = { id: 'r1', setId: 'set1', numero: 1, squadraAlServizio: 'A', esito: 'punto_A', chiusuraManuale: true };
    const rally2: Rally = { id: 'r2', setId: 'set1', numero: 2, squadraAlServizio: 'A', esito: null, chiusuraManuale: false };
    const azioni = new Map<string, Azione[]>([['r1', []], ['r2', []]]);
    const sostituzioni = [{ id: 'sub1', setId: 'set1', dopoRallyNumero: 1, squadra: 'A' as const, giocatoreEsceId: 'a3', giocatoreEntraId: 'libero1' }];
    const stato = deriveSetState(creaSet(), [rally1, rally2], azioni, sostituzioni);
    expect(stato.rotazioneA).toEqual(['a1', 'a2', 'libero1', 'a4', 'a5', 'a6']);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- reducer`
Expected: FAIL — `./reducer` non esiste ancora.

- [ ] **Step 3: Crea `src/domain/reducer.ts`**

```ts
import { ruotaPosizioni, applicaSostituzione } from './rotation';
import type { Azione, Rally, SetPallavolo, Sostituzione, Squadra } from './types';

export interface SetStatoDerivato {
  punteggioA: number;
  punteggioB: number;
  rotazioneA: string[];
  rotazioneB: string[];
  squadraAlServizio: Squadra;
  rallyApertoNumero: number;
}

type ChiaveChiusura = `${Azione['fondamentale']}:${Azione['valutazione']}`;

const TABELLA_CHIUSURA: Partial<Record<ChiaveChiusura, 'esecutore' | 'avversario'>> = {
  'battuta:#': 'esecutore',
  'battuta:=': 'avversario',
  'attacco:#': 'esecutore',
  'attacco:=': 'avversario',
  'muro:#': 'esecutore',
  'muro:=': 'avversario',
};

function squadraOpposta(squadra: Squadra): Squadra {
  return squadra === 'A' ? 'B' : 'A';
}

export function determinaEsitoAutomatico(azioniRally: Azione[]): 'punto_A' | 'punto_B' | null {
  for (const azione of azioniRally) {
    const chiave: ChiaveChiusura = `${azione.fondamentale}:${azione.valutazione}`;
    const risultato = TABELLA_CHIUSURA[chiave];
    if (risultato === 'esecutore') {
      return azione.squadra === 'A' ? 'punto_A' : 'punto_B';
    }
    if (risultato === 'avversario') {
      return squadraOpposta(azione.squadra) === 'A' ? 'punto_A' : 'punto_B';
    }
  }
  return null;
}

export function deriveSetState(
  set: SetPallavolo,
  rallies: Rally[],
  azioniPerRally: Map<string, Azione[]>,
  sostituzioni: Sostituzione[],
): SetStatoDerivato {
  let rotazioneA = [...set.formazioneInizialeA];
  let rotazioneB = [...set.formazioneInizialeB];
  let squadraAlServizio = set.primaSquadraAlServizio;
  let punteggioA = 0;
  let punteggioB = 0;

  const rallyOrdinati = [...rallies].sort((a, b) => a.numero - b.numero);

  const applicaSostituzioniDopo = (numeroRally: number) => {
    for (const sostituzione of sostituzioni.filter((s) => s.dopoRallyNumero === numeroRally)) {
      if (sostituzione.squadra === 'A') rotazioneA = applicaSostituzione(rotazioneA, sostituzione);
      else rotazioneB = applicaSostituzione(rotazioneB, sostituzione);
    }
  };

  for (const rally of rallyOrdinati) {
    applicaSostituzioniDopo(rally.numero - 1);

    const azioniRally = azioniPerRally.get(rally.id) ?? [];
    const esito = rally.chiusuraManuale ? rally.esito : determinaEsitoAutomatico(azioniRally);
    if (!esito) continue;

    const vincitore: Squadra = esito === 'punto_A' ? 'A' : 'B';
    if (vincitore === 'A') punteggioA += 1;
    else punteggioB += 1;

    if (vincitore !== squadraAlServizio) {
      if (vincitore === 'A') rotazioneA = ruotaPosizioni(rotazioneA);
      else rotazioneB = ruotaPosizioni(rotazioneB);
      squadraAlServizio = vincitore;
    }
  }

  const ultimoNumero = rallyOrdinati.at(-1)?.numero ?? 0;
  applicaSostituzioniDopo(ultimoNumero);

  return {
    punteggioA,
    punteggioB,
    rotazioneA,
    rotazioneB,
    squadraAlServizio,
    rallyApertoNumero: ultimoNumero + 1,
  };
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- reducer`
Expected: PASS — tutti i 5 test superati.

- [ ] **Step 5: Commit**

```bash
git add src/domain/reducer.ts src/domain/reducer.test.ts
git commit -m "feat: add event-sourcing rally replay engine"
```

### Task 9: Statistiche (`domain/stats.ts`)

**Files:**
- Create: `src/domain/stats.ts`
- Test: `src/domain/stats.test.ts`

**Interfaces:**
- Consumes: tipi `Azione`, `Fondamentale` da `@/domain/types`.
- Produces: `calcolaStatistiche(azioni, fondamentale, giocatoreId?): StatisticheFondamentale` da `@/domain/stats` (usata dal Task 23, pannello statistiche).

- [ ] **Step 1: Scrivi i test falliti `src/domain/stats.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { calcolaStatistiche } from './stats';
import type { Azione } from './types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 3, direzione: 6,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('calcolaStatistiche', () => {
  it('calcola tentativi, perfetti, errori ed efficienza per un giocatore su un fondamentale', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', valutazione: '#' }),
      creaAzione({ id: 'az2', valutazione: '+' }),
      creaAzione({ id: 'az3', valutazione: '=' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco', 'p1');
    expect(stats.tentativi).toBe(3);
    expect(stats.perfetti).toBe(1);
    expect(stats.errori).toBe(1);
    expect(stats.efficienzaPercento).toBeCloseTo(0);
  });

  it('ignora azioni di altri fondamentali o di altri giocatori', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', valutazione: '#', giocatoreId: 'p2' }),
      creaAzione({ id: 'az3', fondamentale: 'muro', valutazione: '#', giocatoreId: 'p1' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco', 'p1');
    expect(stats.tentativi).toBe(1);
  });

  it('aggrega per squadra quando non si passa un giocatoreId', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'az1', valutazione: '#', giocatoreId: 'p1' }),
      creaAzione({ id: 'az2', valutazione: '#', giocatoreId: 'p2' }),
    ];
    const stats = calcolaStatistiche(azioni, 'attacco');
    expect(stats.tentativi).toBe(2);
    expect(stats.efficienzaPercento).toBeCloseTo(100);
  });

  it('restituisce efficienza 0 quando non ci sono tentativi', () => {
    const stats = calcolaStatistiche([], 'attacco', 'p1');
    expect(stats.tentativi).toBe(0);
    expect(stats.efficienzaPercento).toBe(0);
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- stats`
Expected: FAIL — `./stats` non esiste ancora.

- [ ] **Step 3: Crea `src/domain/stats.ts`**

```ts
import type { Azione, Fondamentale } from './types';

export interface StatisticheFondamentale {
  tentativi: number;
  perfetti: number;
  errori: number;
  efficienzaPercento: number;
}

export function calcolaStatistiche(
  azioni: Azione[],
  fondamentale: Fondamentale,
  giocatoreId?: string,
): StatisticheFondamentale {
  const filtrate = azioni.filter(
    (a) => a.fondamentale === fondamentale && (giocatoreId === undefined || a.giocatoreId === giocatoreId),
  );
  const tentativi = filtrate.length;
  const perfetti = filtrate.filter((a) => a.valutazione === '#').length;
  const errori = filtrate.filter((a) => a.valutazione === '=').length;
  const efficienzaPercento = tentativi === 0 ? 0 : ((perfetti - errori) / tentativi) * 100;
  return { tentativi, perfetti, errori, efficienzaPercento };
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/stats.ts src/domain/stats.test.ts
git commit -m "feat: add per-player and per-team efficiency stats"
```

### Task 10: Analisi tendenze attacco (`domain/analysis.ts`)

**Files:**
- Create: `src/domain/analysis.ts`
- Test: `src/domain/analysis.test.ts`

**Interfaces:**
- Consumes: tipo `Azione` da `@/domain/types`.
- Produces: `classificaDirezione(zonaOrigine, zonaDestinazione): Direzione`, `isMurato(azioneAttacco, azioniSuccessive): boolean`, `analizzaTendenze(tutteLeAzioni, giocatoreId, sogliaAllertaPercento?): TendenzeAttaccante`, `distribuzioneDirezioniAttacco(tutteLeAzioni, giocatoreId): Record<number, number>` da `@/domain/analysis` (usate dal Task 24, pannello Analisi live).

- [ ] **Step 1: Scrivi i test falliti `src/domain/analysis.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { classificaDirezione, isMurato, analizzaTendenze, distribuzioneDirezioniAttacco } from './analysis';
import type { Azione } from './types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('classificaDirezione', () => {
  it('stesso lato (sinistra->sinistra) è parallela', () => {
    expect(classificaDirezione(4, 5)).toBe('parallela');
  });

  it('lati opposti (sinistra->destra) è diagonale', () => {
    expect(classificaDirezione(4, 1)).toBe('diagonale');
  });

  it('colonna centrale coinvolta è centro', () => {
    expect(classificaDirezione(3, 5)).toBe('centro');
    expect(classificaDirezione(4, 8)).toBe('centro');
  });
});

describe('isMurato', () => {
  it('è vero se segue un muro avversario con punto nello stesso rally', () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    const successive = [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '#' })];
    expect(isMurato(attacco, successive)).toBe(true);
  });

  it('è falso se il muro successivo è della stessa squadra o non è punto', () => {
    const attacco = creaAzione({ id: 'att1', squadra: 'A', fondamentale: 'attacco' });
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'A', fondamentale: 'muro', valutazione: '#' })])).toBe(false);
    expect(isMurato(attacco, [creaAzione({ id: 'muro1', squadra: 'B', fondamentale: 'muro', valutazione: '+' })])).toBe(false);
  });
});

describe('analizzaTendenze', () => {
  it('calcola le percentuali di direzione, murato, errore e il colpo principale', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', zona: 4, direzione: 5, valutazione: '#' }),
      creaAzione({ id: 'att2', rallyId: 'r2', zona: 4, direzione: 5, valutazione: '+' }),
      creaAzione({ id: 'att3', rallyId: 'r3', zona: 4, direzione: 1, valutazione: '=' }),
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
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, zona: 4, direzione: 5, valutazione: '=' }),
      creaAzione({ id: 'muro1', rallyId: 'r1', ordine: 2, squadra: 'B', fondamentale: 'muro', valutazione: '#', zona: 3, direzione: 6 }),
    ];
    const tendenze = analizzaTendenze(azioni, 'p1');
    expect(tendenze.percMurato).toBeCloseTo(100);
  });

  it('segnala allerta quando errori+murati superano la soglia', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', rallyId: 'r1', ordine: 1, zona: 4, direzione: 5, valutazione: '=' }),
      creaAzione({ id: 'att2', rallyId: 'r2', ordine: 1, zona: 4, direzione: 5, valutazione: '#' }),
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
  it('conta gli attacchi per zona di destinazione', () => {
    const azioni: Azione[] = [
      creaAzione({ id: 'att1', direzione: 6 }),
      creaAzione({ id: 'att2', direzione: 6 }),
      creaAzione({ id: 'att3', direzione: 5 }),
    ];
    expect(distribuzioneDirezioniAttacco(azioni, 'p1')).toEqual({ 6: 2, 5: 1 });
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- analysis`
Expected: FAIL — `./analysis` non esiste ancora.

- [ ] **Step 3: Crea `src/domain/analysis.ts`**

```ts
import type { Azione } from './types';

export type Direzione = 'parallela' | 'diagonale' | 'centro';
export type Colonna = 'sinistra' | 'centro' | 'destra';

const COLONNA_ORIGINE: Record<number, Colonna> = {
  4: 'sinistra', 5: 'sinistra',
  3: 'centro', 6: 'centro',
  2: 'destra', 1: 'destra',
};

const COLONNA_DESTINAZIONE: Record<number, Colonna> = {
  7: 'sinistra', 4: 'sinistra', 5: 'sinistra',
  8: 'centro', 3: 'centro', 6: 'centro',
  9: 'destra', 2: 'destra', 1: 'destra',
};

export function classificaDirezione(zonaOrigine: number, zonaDestinazione: number): Direzione {
  const colonnaOrigine = COLONNA_ORIGINE[zonaOrigine];
  const colonnaDestinazione = COLONNA_DESTINAZIONE[zonaDestinazione];
  if (colonnaOrigine === undefined || colonnaDestinazione === undefined) {
    throw new Error(`Zona non valida: origine=${zonaOrigine} destinazione=${zonaDestinazione}`);
  }
  if (colonnaOrigine === 'centro' || colonnaDestinazione === 'centro') return 'centro';
  return colonnaOrigine === colonnaDestinazione ? 'parallela' : 'diagonale';
}

export function isMurato(azioneAttacco: Azione, azioniSuccessiveStessoRally: Azione[]): boolean {
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

function raggruppaPerRally(azioni: Azione[]): Map<string, Azione[]> {
  const mappa = new Map<string, Azione[]>();
  for (const azione of azioni) {
    const lista = mappa.get(azione.rallyId) ?? [];
    lista.push(azione);
    mappa.set(azione.rallyId, lista);
  }
  return mappa;
}

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
    if (attacco.zona !== null && attacco.direzione !== null) {
      const direzione = classificaDirezione(attacco.zona, attacco.direzione);
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
): Record<number, number> {
  const attacchi = tutteLeAzioni.filter(
    (a) => a.fondamentale === 'attacco' && a.giocatoreId === giocatoreId && a.direzione !== null,
  );
  const distribuzione: Record<number, number> = {};
  for (const attacco of attacchi) {
    const zona = attacco.direzione as number;
    distribuzione[zona] = (distribuzione[zona] ?? 0) + 1;
  }
  return distribuzione;
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- analysis`
Expected: PASS — tutti i test superati.

- [ ] **Step 5: Commit**

```bash
git add src/domain/analysis.ts src/domain/analysis.test.ts
git commit -m "feat: add attack direction classification and player tendency analysis"
```

### Task 11: Gestione squadre — lista e creazione

**Files:**
- Create: `src/features/teams/TeamListPage.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/squadre`)
- Test: `src/features/teams/TeamListPage.test.tsx`

**Interfaces:**
- Consumes: `db` da `@/db/schema` (Task 3), `creaSquadra` da `@/db/teams` (Task 4).
- Produces: rotta `/squadre` (usata dal Task 12 per il link verso il roster e dal Task 13 per selezionare le squadre in setup partita).

- [ ] **Step 1: Installa `dexie-react-hooks`** (già in `package.json` dal Task 1, verifica sia installato)

Run: `npm install`
Expected: nessun errore, `dexie-react-hooks` presente in `node_modules`.

- [ ] **Step 2: Crea `src/features/teams/TeamListPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra } from '@/db/teams';

export function TeamListPage() {
  const squadre = useLiveQuery(() => db.teams.orderBy('nome').toArray(), []);
  const [nome, setNome] = useState('');

  async function handleCrea(event: FormEvent) {
    event.preventDefault();
    if (!nome.trim()) return;
    await creaSquadra(nome.trim());
    setNome('');
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Squadre</h1>
      <form onSubmit={handleCrea} className="mb-6 flex gap-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome squadra"
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Crea squadra
        </button>
      </form>
      <ul className="space-y-2">
        {(squadre ?? []).map((squadra) => (
          <li key={squadra.id}>
            <Link
              to={`/squadre/${squadra.id}`}
              className="block rounded-lg bg-slate-800 px-4 py-3 text-lg hover:bg-slate-700"
            >
              {squadra.nome}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 3: Aggiungi la rotta in `src/app/router.tsx`**

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { TeamListPage } from '@/features/teams/TeamListPage';

function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <h1 className="text-3xl font-bold">Scouting Pallavolo</h1>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/squadre', element: <TeamListPage /> },
]);
```

- [ ] **Step 4: Scrivi il test `src/features/teams/TeamListPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/db/schema';
import { TeamListPage } from './TeamListPage';

describe('TeamListPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
  });

  it('crea una squadra e la mostra nella lista', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamListPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Nome squadra'), 'Volley Rossi');
    await user.click(screen.getByRole('button', { name: 'Crea squadra' }));

    expect(await screen.findByText('Volley Rossi')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Esegui i test**

Run: `npm test -- TeamListPage`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/teams/TeamListPage.tsx src/features/teams/TeamListPage.test.tsx src/app/router.tsx
git commit -m "feat: add team list page with creation form"
```

### Task 12: Gestione roster giocatori

**Files:**
- Create: `src/features/teams/PlayerRosterEditor.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/squadre/:teamId`)
- Test: `src/features/teams/PlayerRosterEditor.test.tsx`

**Interfaces:**
- Consumes: `db` da `@/db/schema`, `aggiungiGiocatore`, `modificaGiocatore`, `archiviaGiocatore` da `@/db/teams` (Task 4), tipo `Ruolo` da `@/domain/types`.
- Produces: rotta `/squadre/:teamId` (usata dal Task 14, selezione formazione titolare).

- [ ] **Step 1: Crea `src/features/teams/PlayerRosterEditor.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { aggiungiGiocatore, archiviaGiocatore } from '@/db/teams';
import type { Ruolo } from '@/domain/types';

const RUOLI: Ruolo[] = ['palleggiatore', 'opposto', 'schiacciatore', 'centrale', 'libero'];

export function PlayerRosterEditor() {
  const { teamId } = useParams<{ teamId: string }>();
  const squadra = useLiveQuery(() => db.teams.get(teamId!), [teamId]);
  const giocatori = useLiveQuery(
    () => db.players.where('teamId').equals(teamId!).and((p) => p.attivo).sortBy('numero'),
    [teamId],
  );

  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState<Ruolo>('schiacciatore');

  async function handleAggiungi(event: FormEvent) {
    event.preventDefault();
    if (!nome.trim() || !numero) return;
    await aggiungiGiocatore({ teamId: teamId!, numero: Number(numero), nome: nome.trim(), ruolo });
    setNumero('');
    setNome('');
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">{squadra?.nome ?? '...'}</h1>
      <form onSubmit={handleAggiungi} className="mb-6 flex flex-wrap gap-3">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          type="number"
          placeholder="Numero"
          className="w-24 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome giocatore"
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <select
          value={ruolo}
          onChange={(e) => setRuolo(e.target.value as Ruolo)}
          className="rounded-lg bg-slate-800 px-4 py-3 text-lg"
        >
          {RUOLI.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Aggiungi
        </button>
      </form>
      <ul className="space-y-2">
        {(giocatori ?? []).map((giocatore) => (
          <li key={giocatore.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3">
            <span className="text-lg">
              #{giocatore.numero} {giocatore.nome} — {giocatore.ruolo}
            </span>
            <button
              type="button"
              onClick={() => archiviaGiocatore(giocatore.id)}
              className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold"
            >
              Archivia
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Aggiungi la rotta in `src/app/router.tsx`**

```tsx
import { createBrowserRouter } from 'react-router-dom';
import { TeamListPage } from '@/features/teams/TeamListPage';
import { PlayerRosterEditor } from '@/features/teams/PlayerRosterEditor';

function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <h1 className="text-3xl font-bold">Scouting Pallavolo</h1>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/squadre', element: <TeamListPage /> },
  { path: '/squadre/:teamId', element: <PlayerRosterEditor /> },
]);
```

- [ ] **Step 3: Scrivi il test `src/features/teams/PlayerRosterEditor.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra } from '@/db/teams';
import { PlayerRosterEditor } from './PlayerRosterEditor';

describe('PlayerRosterEditor', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
  });

  it('aggiunge un giocatore al roster e lo mostra', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/squadre/${squadra.id}`]}>
        <Routes>
          <Route path="/squadre/:teamId" element={<PlayerRosterEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Numero'), '7');
    await user.type(screen.getByPlaceholderText('Nome giocatore'), 'Bianchi');
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));

    expect(await screen.findByText(/#7 Bianchi/)).toBeInTheDocument();
  });

  it('archivia un giocatore e lo rimuove dalla lista', async () => {
    const squadra = await creaSquadra('Volley Rossi');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/squadre/${squadra.id}`]}>
        <Routes>
          <Route path="/squadre/:teamId" element={<PlayerRosterEditor />} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByPlaceholderText('Numero'), '7');
    await user.type(screen.getByPlaceholderText('Nome giocatore'), 'Bianchi');
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await screen.findByText(/#7 Bianchi/);

    await user.click(screen.getByRole('button', { name: 'Archivia' }));

    expect(screen.queryByText(/#7 Bianchi/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- PlayerRosterEditor`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/teams/PlayerRosterEditor.tsx src/features/teams/PlayerRosterEditor.test.tsx src/app/router.tsx
git commit -m "feat: add player roster CRUD editor"
```

### Task 13: Setup partita

**Files:**
- Create: `src/features/match-setup/MatchSetupPage.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/partite/nuova`)
- Test: `src/features/match-setup/MatchSetupPage.test.tsx`

**Interfaces:**
- Consumes: `db` da `@/db/schema`, `creaPartita` da `@/db/matches` (Task 5).
- Produces: rotta `/partite/nuova`; naviga a `/partite/:matchId/formazione` dopo la creazione (rotta definita nel Task 14).

- [ ] **Step 1: Crea `src/features/match-setup/MatchSetupPage.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaPartita } from '@/db/matches';

export function MatchSetupPage() {
  const navigate = useNavigate();
  const squadre = useLiveQuery(() => db.teams.orderBy('nome').toArray(), []);

  const [squadraAId, setSquadraAId] = useState('');
  const [squadraBId, setSquadraBId] = useState('');
  const [squadraRiferimentoId, setSquadraRiferimentoId] = useState<string>('');
  const [formatoSet, setFormatoSet] = useState<3 | 5>(5);
  const [puntiSet, setPuntiSet] = useState(25);
  const [puntiSetDecisivo, setPuntiSetDecisivo] = useState(15);

  async function handleCrea(event: FormEvent) {
    event.preventDefault();
    if (!squadraAId || !squadraBId || squadraAId === squadraBId) return;
    const match = await creaPartita({
      data: new Date().toISOString().slice(0, 10),
      squadraAId,
      squadraBId,
      squadraRiferimentoId: squadraRiferimentoId || null,
      formatoSet,
      puntiSet,
      puntiSetDecisivo,
    });
    navigate(`/partite/${match.id}/formazione`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Nuova partita</h1>
      <form onSubmit={handleCrea} className="max-w-xl space-y-4">
        <label className="block">
          Squadra A
          <select
            value={squadraAId}
            onChange={(e) => setSquadraAId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          >
            <option value="">Seleziona...</option>
            {(squadre ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Squadra B
          <select
            value={squadraBId}
            onChange={(e) => setSquadraBId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          >
            <option value="">Seleziona...</option>
            {(squadre ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          Squadra di riferimento (facoltativa, per pre-scout tra due squadre terze lascia vuoto)
          <select
            value={squadraRiferimentoId}
            onChange={(e) => setSquadraRiferimentoId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          >
            <option value="">Nessuna</option>
            {squadraAId && <option value={squadraAId}>Squadra A</option>}
            {squadraBId && <option value={squadraBId}>Squadra B</option>}
          </select>
        </label>
        <label className="block">
          Formato set
          <select
            value={formatoSet}
            onChange={(e) => setFormatoSet(Number(e.target.value) as 3 | 5)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          >
            <option value={3}>Al meglio dei 3</option>
            <option value={5}>Al meglio dei 5</option>
          </select>
        </label>
        <label className="block">
          Punti per set
          <input
            type="number"
            value={puntiSet}
            onChange={(e) => setPuntiSet(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          />
        </label>
        <label className="block">
          Punti set decisivo
          <input
            type="number"
            value={puntiSetDecisivo}
            onChange={(e) => setPuntiSetDecisivo(Number(e.target.value))}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
          />
        </label>
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Continua alla formazione
        </button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Aggiungi la rotta in `src/app/router.tsx`**

Aggiungi l'import `import { MatchSetupPage } from '@/features/match-setup/MatchSetupPage';` e la rotta `{ path: '/partite/nuova', element: <MatchSetupPage /> }` all'array passato a `createBrowserRouter`.

- [ ] **Step 3: Scrivi il test `src/features/match-setup/MatchSetupPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra } from '@/db/teams';
import { MatchSetupPage } from './MatchSetupPage';

describe('MatchSetupPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.matches.clear();
  });

  it('crea una partita con le due squadre selezionate', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/partite/nuova']}>
        <Routes>
          <Route path="/partite/nuova" element={<MatchSetupPage />} />
          <Route path="/partite/:matchId/formazione" element={<div>Formazione</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Volley Rossi');
    await user.selectOptions(screen.getByLabelText('Squadra A'), squadraA.id);
    await user.selectOptions(screen.getByLabelText('Squadra B'), squadraB.id);
    await user.click(screen.getByRole('button', { name: 'Continua alla formazione' }));

    expect(await screen.findByText('Formazione')).toBeInTheDocument();
    const partite = await db.matches.toArray();
    expect(partite).toHaveLength(1);
    expect(partite[0].squadraAId).toBe(squadraA.id);
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- MatchSetupPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/match-setup/MatchSetupPage.tsx src/features/match-setup/MatchSetupPage.test.tsx src/app/router.tsx
git commit -m "feat: add match setup page"
```

### Task 14: Formazione titolare e rotazione iniziale

**Files:**
- Create: `src/features/match-setup/LineupPicker.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/partite/:matchId/formazione`)
- Test: `src/features/match-setup/LineupPicker.test.tsx`

**Interfaces:**
- Consumes: `db` da `@/db/schema`, `creaSet` da `@/db/matches` (Task 5), tipo `Squadra` da `@/domain/types`.
- Produces: rotta `/partite/:matchId/formazione`; naviga a `/partite/:matchId/scouting/:setId` dopo la creazione del set (rotta definita nel Task 16).

- [ ] **Step 1: Crea `src/features/match-setup/LineupPicker.tsx`**

```tsx
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSet } from '@/db/matches';
import type { Player, Squadra } from '@/domain/types';

function useRosterAttivo(teamId: string | undefined) {
  return useLiveQuery(
    () => (teamId ? db.players.where('teamId').equals(teamId).and((p) => p.attivo).sortBy('numero') : []),
    [teamId],
  );
}

function SelettoreFormazione({
  giocatori,
  selezionati,
  onToggle,
}: {
  giocatori: Player[];
  selezionati: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {giocatori.map((g) => {
        const posizione = selezionati.indexOf(g.id);
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onToggle(g.id)}
              className={`w-full rounded-lg px-4 py-3 text-left text-lg ${posizione >= 0 ? 'bg-blue-700' : 'bg-slate-800'}`}
            >
              {posizione >= 0 ? `P${posizione + 1} — ` : ''}#{g.numero} {g.nome}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LineupPicker() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const match = useLiveQuery(() => db.matches.get(matchId!), [matchId]);
  const giocatoriA = useRosterAttivo(match?.squadraAId);
  const giocatoriB = useRosterAttivo(match?.squadraBId);

  const [formazioneA, setFormazioneA] = useState<string[]>([]);
  const [formazioneB, setFormazioneB] = useState<string[]>([]);
  const [primaSquadraAlServizio, setPrimaSquadraAlServizio] = useState<Squadra>('A');

  function toggle(formazione: string[], setFormazione: (v: string[]) => void, id: string) {
    if (formazione.includes(id)) setFormazione(formazione.filter((g) => g !== id));
    else if (formazione.length < 6) setFormazione([...formazione, id]);
  }

  async function handleContinua() {
    if (!match || formazioneA.length !== 6 || formazioneB.length !== 6) return;
    const set = await creaSet({
      matchId: match.id,
      numero: 1,
      formazioneInizialeA: formazioneA,
      formazioneInizialeB: formazioneB,
      primaSquadraAlServizio,
    });
    navigate(`/partite/${match.id}/scouting/${set.id}`);
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Formazione titolare</h1>
      <p className="mb-4">Tocca i giocatori nellordine di rotazione P1...P6 (P1 al servizio).</p>
      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra A ({formazioneA.length}/6)</h2>
          <SelettoreFormazione
            giocatori={giocatoriA ?? []}
            selezionati={formazioneA}
            onToggle={(id) => toggle(formazioneA, setFormazioneA, id)}
          />
        </div>
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra B ({formazioneB.length}/6)</h2>
          <SelettoreFormazione
            giocatori={giocatoriB ?? []}
            selezionati={formazioneB}
            onToggle={(id) => toggle(formazioneB, setFormazioneB, id)}
          />
        </div>
      </div>
      <label className="mb-6 block text-lg">
        Al servizio per prima
        <select
          value={primaSquadraAlServizio}
          onChange={(e) => setPrimaSquadraAlServizio(e.target.value as Squadra)}
          className="mt-1 block w-48 rounded-lg bg-slate-800 px-4 py-3"
        >
          <option value="A">Squadra A</option>
          <option value="B">Squadra B</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleContinua}
        disabled={formazioneA.length !== 6 || formazioneB.length !== 6}
        className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-40"
      >
        Inizia partita
      </button>
    </main>
  );
}
```

- [ ] **Step 2: Aggiungi la rotta in `src/app/router.tsx`**

Aggiungi l'import `import { LineupPicker } from '@/features/match-setup/LineupPicker';` e la rotta `{ path: '/partite/:matchId/formazione', element: <LineupPicker /> }`.

- [ ] **Step 3: Scrivi il test `src/features/match-setup/LineupPicker.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita } from '@/db/matches';
import { LineupPicker } from './LineupPicker';

async function creaRosterDaSei(teamId: string, prefisso: string) {
  for (let i = 1; i <= 6; i += 1) {
    await aggiungiGiocatore({ teamId, numero: i, nome: `${prefisso}${i}`, ruolo: 'schiacciatore' });
  }
}

describe('LineupPicker', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
  });

  it('crea il set con le due formazioni nellordine di tap e naviga alla schermata di scouting', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    await creaRosterDaSei(squadraA.id, 'A');
    await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16',
      squadraAId: squadraA.id,
      squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id,
      formatoSet: 5,
      puntiSet: 25,
      puntiSetDecisivo: 15,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
        <Routes>
          <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
        </Routes>
      </MemoryRouter>,
    );

    for (let i = 1; i <= 6; i += 1) {
      await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
      await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
    }
    await user.click(screen.getByRole('button', { name: 'Inizia partita' }));

    expect(await screen.findByText('Scouting avviato')).toBeInTheDocument();
    const set = (await db.sets.toArray())[0];
    expect(set.formazioneInizialeA).toEqual(
      (await db.players.where('teamId').equals(squadraA.id).sortBy('numero')).map((p) => p.id),
    );
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- LineupPicker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/match-setup/LineupPicker.tsx src/features/match-setup/LineupPicker.test.tsx src/app/router.tsx
git commit -m "feat: add starting lineup and initial rotation picker"
```

### Task 15: Store Zustand della partita in corso

**Files:**
- Create: `src/store/liveMatchStore.ts`
- Test: `src/store/liveMatchStore.test.ts`

**Interfaces:**
- Consumes: `deriveSetState`, `SetStatoDerivato` da `@/domain/reducer` (Task 8), `salvaRally`, `aggiornaRallyEsito`, `salvaAzione`, `eliminaAzione`, `eliminaRallySeVuoto`, `salvaSostituzione`, `salvaTimeout` da `@/db/scouting` (Task 6), tipi da `@/domain/types`.
- Produces: hook `useLiveMatchStore` da `@/store/liveMatchStore`, con stato `{ set, rallies, azioni, sostituzioni, timeouts }` e azioni `caricaSet`, `statoDerivato`, `registraAzione`, `annullaUltimaAzione`, `chiudiRallyManuale`, `aggiungiSostituzione`, `aggiungiTimeout` (usato dai Task 16-22).

- [ ] **Step 1: Crea `src/store/liveMatchStore.ts`**

```ts
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Azione, Rally, SetPallavolo, Sostituzione, Timeout, Squadra } from '@/domain/types';
import { deriveSetState, type SetStatoDerivato } from '@/domain/reducer';
import {
  salvaRally,
  aggiornaRallyEsito,
  salvaAzione,
  eliminaAzione,
  eliminaRallySeVuoto,
  salvaSostituzione,
  salvaTimeout,
} from '@/db/scouting';

interface DatiSetIniziali {
  set: SetPallavolo;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
}

interface LiveMatchState {
  set: SetPallavolo | null;
  rallies: Rally[];
  azioni: Azione[];
  sostituzioni: Sostituzione[];
  timeouts: Timeout[];
  caricaSet: (dati: DatiSetIniziali) => void;
  statoDerivato: () => SetStatoDerivato;
  registraAzione: (input: Omit<Azione, 'id' | 'rallyId' | 'setId' | 'ordine' | 'timestamp'>) => Promise<void>;
  annullaUltimaAzione: () => Promise<void>;
  chiudiRallyManuale: (esito: 'punto_A' | 'punto_B') => Promise<void>;
  aggiungiSostituzione: (input: Omit<Sostituzione, 'id' | 'setId' | 'dopoRallyNumero'>) => Promise<void>;
  aggiungiTimeout: (squadra: Squadra) => Promise<void>;
}

function raggruppaPerRally(azioni: Azione[]): Map<string, Azione[]> {
  const mappa = new Map<string, Azione[]>();
  for (const azione of azioni) {
    const lista = mappa.get(azione.rallyId) ?? [];
    lista.push(azione);
    mappa.set(azione.rallyId, lista);
  }
  return mappa;
}

export const useLiveMatchStore = create<LiveMatchState>((set, get) => ({
  set: null,
  rallies: [],
  azioni: [],
  sostituzioni: [],
  timeouts: [],

  caricaSet: (dati) =>
    set({
      set: dati.set,
      rallies: dati.rallies,
      azioni: dati.azioni,
      sostituzioni: dati.sostituzioni,
      timeouts: dati.timeouts,
    }),

  statoDerivato: () => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    return deriveSetState(stato.set, stato.rallies, raggruppaPerRally(stato.azioni), stato.sostituzioni);
  },

  registraAzione: async (input) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    let rallyAperto = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
    if (!rallyAperto) {
      rallyAperto = {
        id: uuidv4(),
        setId: stato.set.id,
        numero: derivato.rallyApertoNumero,
        squadraAlServizio: derivato.squadraAlServizio,
        esito: null,
        chiusuraManuale: false,
      };
      await salvaRally(rallyAperto);
      set((s) => ({ rallies: [...s.rallies, rallyAperto!] }));
    }
    const ordine = get().azioni.filter((a) => a.rallyId === rallyAperto!.id).length + 1;
    const azione: Azione = {
      id: uuidv4(),
      rallyId: rallyAperto.id,
      setId: stato.set.id,
      ordine,
      timestamp: new Date().toISOString(),
      ...input,
    };
    await salvaAzione(azione);
    set((s) => ({ azioni: [...s.azioni, azione] }));
  },

  annullaUltimaAzione: async () => {
    const ultima = get().azioni.at(-1);
    if (!ultima) return;
    await eliminaAzione(ultima.id);
    set((s) => ({ azioni: s.azioni.filter((a) => a.id !== ultima.id) }));
    const azioniRimasteRally = get().azioni.filter((a) => a.rallyId === ultima.rallyId);
    if (azioniRimasteRally.length === 0) {
      await eliminaRallySeVuoto(ultima.rallyId);
      set((s) => ({ rallies: s.rallies.filter((r) => r.id !== ultima.rallyId) }));
    }
  },

  chiudiRallyManuale: async (esito) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    const rallyAperto = stato.rallies.find((r) => r.numero === derivato.rallyApertoNumero);
    if (!rallyAperto) {
      const nuovoRally: Rally = {
        id: uuidv4(),
        setId: stato.set.id,
        numero: derivato.rallyApertoNumero,
        squadraAlServizio: derivato.squadraAlServizio,
        esito,
        chiusuraManuale: true,
      };
      await salvaRally(nuovoRally);
      set((s) => ({ rallies: [...s.rallies, nuovoRally] }));
    } else {
      const aggiornato: Rally = { ...rallyAperto, esito, chiusuraManuale: true };
      await aggiornaRallyEsito(aggiornato);
      set((s) => ({ rallies: s.rallies.map((r) => (r.id === aggiornato.id ? aggiornato : r)) }));
    }
  },

  aggiungiSostituzione: async (input) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    const sostituzione: Sostituzione = {
      id: uuidv4(),
      setId: stato.set.id,
      dopoRallyNumero: derivato.rallyApertoNumero - 1,
      ...input,
    };
    await salvaSostituzione(sostituzione);
    set((s) => ({ sostituzioni: [...s.sostituzioni, sostituzione] }));
  },

  aggiungiTimeout: async (squadra) => {
    const stato = get();
    if (!stato.set) throw new Error('Nessun set caricato');
    const derivato = stato.statoDerivato();
    const timeout: Timeout = {
      id: uuidv4(),
      setId: stato.set.id,
      dopoRallyNumero: derivato.rallyApertoNumero - 1,
      squadra,
    };
    await salvaTimeout(timeout);
    set((s) => ({ timeouts: [...s.timeouts, timeout] }));
  },
}));
```

- [ ] **Step 2: Scrivi il test `src/store/liveMatchStore.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db/schema';
import { useLiveMatchStore } from './liveMatchStore';
import type { SetPallavolo } from '@/domain/types';

function creaSetDiTest(): SetPallavolo {
  return {
    id: 'set-test',
    matchId: 'match-test',
    numero: 1,
    formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
    formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
    primaSquadraAlServizio: 'A',
    stato: 'in_corso',
    vincitore: null,
  };
}

describe('useLiveMatchStore', () => {
  beforeEach(async () => {
    await db.rallies.clear();
    await db.azioni.clear();
    await db.sostituzioni.clear();
    await db.timeouts.clear();
    useLiveMatchStore.getState().caricaSet({
      set: creaSetDiTest(), rallies: [], azioni: [], sostituzioni: [], timeouts: [],
    });
  });

  it('parte da 0-0 dopo il caricamento del set', () => {
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(0);
    expect(stato.punteggioB).toBe(0);
  });

  it('registra un ace e aggiorna il punteggio derivato', async () => {
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
      valutazione: '#', zona: 1, direzione: 5,
    });
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(1);
    expect(await db.azioni.count()).toBe(1);
  });

  it('annulla lultima azione e rimuove anche il rally vuoto', async () => {
    await useLiveMatchStore.getState().registraAzione({
      squadra: 'A', giocatoreId: 'a1', fondamentale: 'battuta', tipoBattuta: 'flottante',
      valutazione: '#', zona: 1, direzione: 5,
    });
    await useLiveMatchStore.getState().annullaUltimaAzione();
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioA).toBe(0);
    expect(await db.azioni.count()).toBe(0);
    expect(await db.rallies.count()).toBe(0);
  });

  it('chiude un rally manualmente ignorando eventuali azioni presenti', async () => {
    await useLiveMatchStore.getState().chiudiRallyManuale('punto_B');
    const stato = useLiveMatchStore.getState().statoDerivato();
    expect(stato.punteggioB).toBe(1);
  });

  it('registra una sostituzione riferita al rally aperto corrente', async () => {
    await useLiveMatchStore.getState().aggiungiSostituzione({
      squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'libero1',
    });
    const sostituzioni = await db.sostituzioni.toArray();
    expect(sostituzioni[0].dopoRallyNumero).toBe(0);
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- liveMatchStore`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/store/liveMatchStore.ts src/store/liveMatchStore.test.ts
git commit -m "feat: add zustand store for the in-progress set"
```

### Task 16: Shell schermata di scouting live

**Files:**
- Create: `src/features/live-scouting/flowLogic.ts`
- Create: `src/features/live-scouting/LiveScoutingScreen.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/partite/:matchId/scouting/:setId`)
- Test: `src/features/live-scouting/flowLogic.test.ts`, `src/features/live-scouting/LiveScoutingScreen.test.tsx`

**Interfaces:**
- Consumes: `useLiveMatchStore` da `@/store/liveMatchStore` (Task 15), `caricaDatiSet` da `@/db/scouting` (Task 6), `db` da `@/db/schema`.
- Produces: rotta `/partite/:matchId/scouting/:setId`; `determinaPassoAtteso(azioniRallyAperto: Azione[]): PassoAtteso` da `@/features/live-scouting/flowLogic` (usata dai Task 18-20 per decidere quale tap-flow mostrare); area `data-testid="area-tap-flow"` dentro `LiveScoutingScreen` dove i Task 18-20 innestano i componenti di tap-flow.

- [ ] **Step 1: Scrivi il test `src/features/live-scouting/flowLogic.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { determinaPassoAtteso } from './flowLogic';
import type { Azione } from '@/domain/types';

function creaAzione(fondamentale: Azione['fondamentale']): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale, tipoBattuta: null, valutazione: '#', zona: 1, direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z',
  };
}

describe('determinaPassoAtteso', () => {
  it('è battuta quando il rally aperto non ha ancora azioni', () => {
    expect(determinaPassoAtteso([])).toBe('battuta');
  });

  it('è ricezione subito dopo una battuta', () => {
    expect(determinaPassoAtteso([creaAzione('battuta')])).toBe('ricezione');
  });

  it('è attacco subito dopo una ricezione', () => {
    expect(determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione')])).toBe('attacco');
  });

  it('è un bivio dopo un attacco o un muro', () => {
    expect(determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione'), creaAzione('attacco')])).toBe('bivio');
    expect(
      determinaPassoAtteso([creaAzione('battuta'), creaAzione('ricezione'), creaAzione('attacco'), creaAzione('muro')]),
    ).toBe('bivio');
  });
});
```

- [ ] **Step 2: Esegui i test e verifica che falliscano**

Run: `npm test -- flowLogic`
Expected: FAIL — `./flowLogic` non esiste ancora.

- [ ] **Step 3: Crea `src/features/live-scouting/flowLogic.ts`**

```ts
import type { Azione } from '@/domain/types';

export type PassoAtteso = 'battuta' | 'ricezione' | 'attacco' | 'bivio';

export function determinaPassoAtteso(azioniRallyAperto: Azione[]): PassoAtteso {
  if (azioniRallyAperto.length === 0) return 'battuta';
  const ultima = azioniRallyAperto.at(-1)!;
  if (ultima.fondamentale === 'battuta') return 'ricezione';
  if (ultima.fondamentale === 'ricezione') return 'attacco';
  return 'bivio';
}
```

- [ ] **Step 4: Esegui i test e verifica che passino**

Run: `npm test -- flowLogic`
Expected: PASS.

- [ ] **Step 5: Crea `src/features/live-scouting/LiveScoutingScreen.tsx`**

```tsx
import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { determinaPassoAtteso } from './flowLogic';

export function LiveScoutingScreen() {
  const { matchId, setId } = useParams<{ matchId: string; setId: string }>();
  const caricaSet = useLiveMatchStore((s) => s.caricaSet);
  const rallies = useLiveMatchStore((s) => s.rallies);
  const azioni = useLiveMatchStore((s) => s.azioni);
  const annullaUltimaAzione = useLiveMatchStore((s) => s.annullaUltimaAzione);
  const chiudiRallyManuale = useLiveMatchStore((s) => s.chiudiRallyManuale);
  const derivato = useLiveMatchStore((s) => (s.set ? s.statoDerivato() : null));

  const setRecord = useLiveQuery(() => db.sets.get(setId!), [setId]);
  const match = useLiveQuery(() => db.matches.get(matchId!), [matchId]);
  const giocatori = useLiveQuery(async () => {
    if (!match) return [];
    const [giocatoriA, giocatoriB] = await Promise.all([
      db.players.where('teamId').equals(match.squadraAId).toArray(),
      db.players.where('teamId').equals(match.squadraBId).toArray(),
    ]);
    return [...giocatoriA, ...giocatoriB];
  }, [match]);

  useEffect(() => {
    if (!setRecord) return;
    caricaDatiSet(setRecord.id).then((dati) => caricaSet({ set: setRecord, ...dati }));
  }, [setRecord, caricaSet]);

  if (!derivato) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  const nomeGiocatore = (id: string) => {
    const giocatore = giocatori?.find((g) => g.id === id);
    return giocatore ? `#${giocatore.numero} ${giocatore.nome}` : id;
  };

  const rallyAperto = rallies.find((r) => r.numero === derivato.rallyApertoNumero);
  const azioniRallyAperto = rallyAperto ? azioni.filter((a) => a.rallyId === rallyAperto.id) : [];
  const passoAtteso = determinaPassoAtteso(azioniRallyAperto);

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 p-4 text-white">
      <header className="mb-4 flex items-center justify-between rounded-lg bg-slate-900 px-6 py-4">
        <button
          type="button"
          onClick={() => annullaUltimaAzione()}
          className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold"
        >
          Annulla ultima azione
        </button>
        <div className="text-3xl font-bold" data-testid="punteggio">
          {derivato.punteggioA} : {derivato.punteggioB}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_A')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Punto A
          </button>
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_B')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Punto B
          </button>
        </div>
      </header>
      <section className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Squadra A in campo</h2>
          <div className="flex flex-wrap gap-2" data-testid="rotazione-a">
            {derivato.rotazioneA.map((giocatoreId, indice) => (
              <span key={giocatoreId} className="rounded bg-slate-800 px-3 py-1 text-sm">
                P{indice + 1}: {nomeGiocatore(giocatoreId)}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Squadra B in campo</h2>
          <div className="flex flex-wrap gap-2" data-testid="rotazione-b">
            {derivato.rotazioneB.map((giocatoreId, indice) => (
              <span key={giocatoreId} className="rounded bg-slate-800 px-3 py-1 text-sm">
                P{indice + 1}: {nomeGiocatore(giocatoreId)}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="flex-1 rounded-lg bg-slate-900 p-4" data-testid="area-tap-flow">
        <p className="text-lg">Prossimo fondamentale atteso: {passoAtteso}</p>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Aggiungi la rotta in `src/app/router.tsx`**

Aggiungi l'import `import { LiveScoutingScreen } from '@/features/live-scouting/LiveScoutingScreen';` e la rotta `{ path: '/partite/:matchId/scouting/:setId', element: <LiveScoutingScreen /> }`.

- [ ] **Step 7: Scrivi il test `src/features/live-scouting/LiveScoutingScreen.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { LiveScoutingScreen } from './LiveScoutingScreen';

async function creaRosterDaSei(teamId: string, prefisso: string) {
  const giocatori = [];
  for (let i = 1; i <= 6; i += 1) {
    giocatori.push(await aggiungiGiocatore({ teamId, numero: i, nome: `${prefisso}${i}`, ruolo: 'schiacciatore' }));
  }
  return giocatori;
}

describe('LiveScoutingScreen', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
    useLiveMatchStore.setState({ set: null, rallies: [], azioni: [], sostituzioni: [], timeouts: [] });
  });

  it('mostra punteggio 0:0, la formazione titolare e aggiorna il punteggio con la chiusura manuale', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
    const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: giocatoriA.map((g) => g.id),
      formazioneInizialeB: giocatoriB.map((g) => g.id),
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
        <Routes>
          <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('punteggio')).toHaveTextContent('0 : 0');
    expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P1: #1 A1');
    expect(screen.getByText('Prossimo fondamentale atteso: battuta')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Punto A' }));
    expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
  });
});
```

- [ ] **Step 8: Esegui i test**

Run: `npm test -- LiveScoutingScreen`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/live-scouting/flowLogic.ts src/features/live-scouting/flowLogic.test.ts src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx src/app/router.tsx
git commit -m "feat: add live scouting screen shell with score, rotation and manual rally controls"
```

### Task 17: Componenti condivisi — griglia zone e valutazione

**Files:**
- Create: `src/components/ZoneGrid.tsx`
- Create: `src/components/ValutazioneButtons.tsx`
- Test: `src/components/ZoneGrid.test.tsx`, `src/components/ValutazioneButtons.test.tsx`

**Interfaces:**
- Produces: `<ZoneGrid variante="origine" | "destinazione" onSeleziona={(zona: number) => void} />`, `<ValutazioneButtons onSeleziona={(v: Valutazione) => void} />` da `@/components/ZoneGrid` e `@/components/ValutazioneButtons` (usati dai Task 18-20).

- [ ] **Step 1: Crea `src/components/ZoneGrid.tsx`**

```tsx
interface ZoneGridProps {
  variante: 'origine' | 'destinazione';
  onSeleziona: (zona: number) => void;
}

const CELLE_ORIGINE: number[][] = [
  [4, 3, 2],
  [5, 6, 1],
];

const CELLE_DESTINAZIONE: number[][] = [
  [7, 8, 9],
  [4, 3, 2],
  [5, 6, 1],
];

export function ZoneGrid({ variante, onSeleziona }: ZoneGridProps) {
  const righe = variante === 'origine' ? CELLE_ORIGINE : CELLE_DESTINAZIONE;
  return (
    <div className="flex flex-col gap-2" data-testid="zone-grid">
      {righe.map((riga, i) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          {riga.map((zona) => (
            <button
              key={zona}
              type="button"
              onClick={() => onSeleziona(zona)}
              className="aspect-square rounded-xl bg-slate-700 text-2xl font-bold text-white active:bg-slate-500"
            >
              {zona}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Crea `src/components/ValutazioneButtons.tsx`**

```tsx
import type { Valutazione } from '@/domain/types';

const VALUTAZIONI: Valutazione[] = ['#', '+', '!', '-', '='];

export function ValutazioneButtons({ onSeleziona }: { onSeleziona: (v: Valutazione) => void }) {
  return (
    <div className="flex gap-3">
      {VALUTAZIONI.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSeleziona(v)}
          className="h-16 w-16 rounded-full bg-slate-700 text-2xl font-bold text-white active:bg-slate-500"
        >
          {v}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Scrivi i test**

```tsx
// src/components/ZoneGrid.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoneGrid } from './ZoneGrid';

describe('ZoneGrid', () => {
  it('mostra 6 celle per la variante origine con la disposizione standard 4-3-2/5-6-1', () => {
    render(<ZoneGrid variante="origine" onSeleziona={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  it('mostra 9 celle per la variante destinazione e invoca onSeleziona con la zona corretta', async () => {
    const onSeleziona = vi.fn();
    const user = userEvent.setup();
    render(<ZoneGrid variante="destinazione" onSeleziona={onSeleziona} />);
    expect(screen.getAllByRole('button')).toHaveLength(9);
    await user.click(screen.getByText('6'));
    expect(onSeleziona).toHaveBeenCalledWith(6);
  });
});
```

```tsx
// src/components/ValutazioneButtons.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ValutazioneButtons } from './ValutazioneButtons';

describe('ValutazioneButtons', () => {
  it('mostra le 5 valutazioni standard e invoca onSeleziona con quella scelta', async () => {
    const onSeleziona = vi.fn();
    const user = userEvent.setup();
    render(<ValutazioneButtons onSeleziona={onSeleziona} />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
    await user.click(screen.getByText('#'));
    expect(onSeleziona).toHaveBeenCalledWith('#');
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- ZoneGrid ValutazioneButtons`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ZoneGrid.tsx src/components/ZoneGrid.test.tsx src/components/ValutazioneButtons.tsx src/components/ValutazioneButtons.test.tsx
git commit -m "feat: add shared zone grid and evaluation button components"
```

### Task 18: Tap-flow Battuta

**Files:**
- Create: `src/features/live-scouting/BattutaFlow.tsx`
- Test: `src/features/live-scouting/BattutaFlow.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (innesta `BattutaFlow` nell'area tap-flow quando `passoAtteso === 'battuta'`)
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx` (nuovo test end-to-end della battuta)

**Interfaces:**
- Consumes: `ZoneGrid`, `ValutazioneButtons` da `@/components/*` (Task 17), tipi `TipoBattuta`/`Valutazione` da `@/domain/types`.
- Produces: `<BattutaFlow onCompleta={(dati: DatiBattuta) => void} />` da `@/features/live-scouting/BattutaFlow` (interfaccia `DatiBattuta = { tipoBattuta, valutazione, zona, direzione }`), innestato in `LiveScoutingScreen`.

- [ ] **Step 1: Crea `src/features/live-scouting/BattutaFlow.tsx`**

```tsx
import { useState } from 'react';
import type { TipoBattuta, Valutazione } from '@/domain/types';
import { ZoneGrid } from '@/components/ZoneGrid';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiBattuta {
  tipoBattuta: TipoBattuta;
  valutazione: Valutazione;
  zona: number;
  direzione: number;
}

type Passo = 'tipo' | 'valutazione' | 'zona' | 'direzione';

const TIPI_BATTUTA: { valore: TipoBattuta; etichetta: string }[] = [
  { valore: 'flottante', etichetta: 'Flottante' },
  { valore: 'salto_flottante', etichetta: 'Salto flottante' },
  { valore: 'salto_spin', etichetta: 'Salto spin' },
];

export function BattutaFlow({ onCompleta }: { onCompleta: (dati: DatiBattuta) => void }) {
  const [passo, setPasso] = useState<Passo>('tipo');
  const [tipoBattuta, setTipoBattuta] = useState<TipoBattuta | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [zona, setZona] = useState<number | null>(null);

  if (passo === 'tipo') {
    return (
      <div className="flex gap-3">
        {TIPI_BATTUTA.map((tipo) => (
          <button
            key={tipo.valore}
            type="button"
            onClick={() => {
              setTipoBattuta(tipo.valore);
              setPasso('valutazione');
            }}
            className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
          >
            {tipo.etichetta}
          </button>
        ))}
      </div>
    );
  }

  if (passo === 'valutazione') {
    return (
      <ValutazioneButtons
        onSeleziona={(v) => {
          setValutazione(v);
          setPasso('zona');
        }}
      />
    );
  }

  if (passo === 'zona') {
    return (
      <ZoneGrid
        variante="origine"
        onSeleziona={(z) => {
          setZona(z);
          setPasso('direzione');
        }}
      />
    );
  }

  return (
    <ZoneGrid
      variante="destinazione"
      onSeleziona={(direzione) => {
        onCompleta({ tipoBattuta: tipoBattuta!, valutazione: valutazione!, zona: zona!, direzione });
      }}
    />
  );
}
```

- [ ] **Step 2: Scrivi il test `src/features/live-scouting/BattutaFlow.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BattutaFlow } from './BattutaFlow';

describe('BattutaFlow', () => {
  it('raccoglie tipo, valutazione, zona e direzione e chiama onCompleta con i dati completi', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<BattutaFlow onCompleta={onCompleta} />);

    await user.click(screen.getByText('Salto flottante'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByRole('button');
    await user.click(celleDirezione[0]);

    expect(onCompleta).toHaveBeenCalledWith({
      tipoBattuta: 'salto_flottante',
      valutazione: '#',
      zona: 4,
      direzione: 7,
    });
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- BattutaFlow`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per innestare `BattutaFlow`**

Aggiungi l'import in cima al file:

```tsx
import { BattutaFlow } from './BattutaFlow';
```

Aggiungi il selettore `registraAzione` accanto agli altri selettori dello store:

```tsx
const registraAzione = useLiveMatchStore((s) => s.registraAzione);
```

Sostituisci il contenuto della `<section data-testid="area-tap-flow">` con:

```tsx
<section className="flex-1 rounded-lg bg-slate-900 p-4" data-testid="area-tap-flow">
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
        });
      }}
    />
  )}
  {passoAtteso !== 'battuta' && <p className="text-lg">Prossimo fondamentale atteso: {passoAtteso}</p>}
</section>
```

- [ ] **Step 5: Aggiungi un nuovo test in `src/features/live-scouting/LiveScoutingScreen.test.tsx`**

Aggiungi, dentro il blocco `describe('LiveScoutingScreen', ...)`, dopo il test esistente:

```tsx
it('completa il tap-flow della battuta e registra unazione che aggiorna il punteggio', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
  const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: giocatoriA.map((g) => g.id),
    formazioneInizialeB: giocatoriB.map((g) => g.id),
    primaSquadraAlServizio: 'A',
  });
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
      <Routes>
        <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Flottante');
  await user.click(screen.getByText('Flottante'));
  await user.click(screen.getByText('#'));
  const celleZona = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
  await user.click(celleZona[0]);
  const celleDirezione = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
  await user.click(celleDirezione[0]);

  expect(await screen.findByTestId('punteggio')).toHaveTextContent('1 : 0');
  expect(await db.azioni.count()).toBe(1);
});
```

- [ ] **Step 6: Esegui i test**

Run: `npm test -- LiveScoutingScreen`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/live-scouting/BattutaFlow.tsx src/features/live-scouting/BattutaFlow.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: wire the battuta tap-flow into the live scouting screen"
```

### Task 19: Tap-flow Ricezione

**Files:**
- Create: `src/features/live-scouting/RicezioneFlow.tsx`
- Test: `src/features/live-scouting/RicezioneFlow.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (innesta `RicezioneFlow` quando `passoAtteso === 'ricezione'`)

**Interfaces:**
- Consumes: `ZoneGrid`, `ValutazioneButtons` da `@/components/*` (Task 17), tipo `Valutazione` da `@/domain/types`.
- Produces: `<RicezioneFlow giocatoriInCampo={GiocatoreInCampo[]} onCompleta={(dati: DatiRicezione) => void} />` da `@/features/live-scouting/RicezioneFlow` (interfaccia `DatiRicezione = { giocatoreId, valutazione, zona }`).

- [ ] **Step 1: Crea `src/features/live-scouting/RicezioneFlow.tsx`**

```tsx
import { useState } from 'react';
import type { Valutazione } from '@/domain/types';
import { ZoneGrid } from '@/components/ZoneGrid';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface GiocatoreInCampo {
  id: string;
  numero: number;
  nome: string;
}

export interface DatiRicezione {
  giocatoreId: string;
  valutazione: Valutazione;
  zona: number;
}

type Passo = 'giocatore' | 'valutazione' | 'zona';

export function RicezioneFlow({
  giocatoriInCampo,
  onCompleta,
}: {
  giocatoriInCampo: GiocatoreInCampo[];
  onCompleta: (dati: DatiRicezione) => void;
}) {
  const [passo, setPasso] = useState<Passo>('giocatore');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);

  if (passo === 'giocatore') {
    return (
      <div className="grid grid-cols-3 gap-3">
        {giocatoriInCampo.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGiocatoreId(g.id);
              setPasso('valutazione');
            }}
            className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
          >
            #{g.numero} {g.nome}
          </button>
        ))}
      </div>
    );
  }

  if (passo === 'valutazione') {
    return (
      <ValutazioneButtons
        onSeleziona={(v) => {
          setValutazione(v);
          setPasso('zona');
        }}
      />
    );
  }

  return (
    <ZoneGrid
      variante="origine"
      onSeleziona={(zona) => {
        onCompleta({ giocatoreId: giocatoreId!, valutazione: valutazione!, zona });
      }}
    />
  );
}
```

- [ ] **Step 2: Scrivi il test `src/features/live-scouting/RicezioneFlow.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RicezioneFlow } from './RicezioneFlow';

describe('RicezioneFlow', () => {
  it('raccoglie giocatore, valutazione e zona e chiama onCompleta', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(
      <RicezioneFlow
        giocatoriInCampo={[{ id: 'p1', numero: 5, nome: 'Bianchi' }]}
        onCompleta={onCompleta}
      />,
    );

    await user.click(screen.getByText('#5 Bianchi'));
    await user.click(screen.getByText('!'));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);

    expect(onCompleta).toHaveBeenCalledWith({ giocatoreId: 'p1', valutazione: '!', zona: 4 });
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- RicezioneFlow`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per innestare `RicezioneFlow`**

Aggiungi l'import:

```tsx
import { RicezioneFlow } from './RicezioneFlow';
```

Aggiungi, subito prima del `return` del componente, il calcolo dei giocatori in campo della squadra ricevente:

```tsx
const squadraRicevente = derivato.squadraAlServizio === 'A' ? 'B' : 'A';
const rotazioneRicevente = squadraRicevente === 'A' ? derivato.rotazioneA : derivato.rotazioneB;
const giocatoriInCampoRicezione = rotazioneRicevente
  .map((id) => giocatori?.find((g) => g.id === id))
  .filter((g): g is NonNullable<typeof g> => Boolean(g));
```

Sostituisci la riga `{passoAtteso !== 'battuta' && <p ...>}` con:

```tsx
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
      })
    }
  />
)}
{passoAtteso !== 'battuta' && passoAtteso !== 'ricezione' && (
  <p className="text-lg">Prossimo fondamentale atteso: {passoAtteso}</p>
)}
```

- [ ] **Step 5: Esegui i test**

Run: `npm test -- LiveScoutingScreen`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/live-scouting/RicezioneFlow.tsx src/features/live-scouting/RicezioneFlow.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx
git commit -m "feat: wire the ricezione tap-flow into the live scouting screen"
```

### Task 20: Tap-flow Attacco/Muro (bivio)

**Files:**
- Modify: `src/domain/reducer.ts` (esporta `squadraOpposta`)
- Modify: `src/domain/reducer.test.ts` (nuovo test per `squadraOpposta`)
- Create: `src/features/live-scouting/AttaccoMuroFlow.tsx`
- Test: `src/features/live-scouting/AttaccoMuroFlow.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (innesta `AttaccoMuroFlow` per `passoAtteso === 'attacco' | 'bivio'`, rimuove il paragrafo segnaposto)

**Interfaces:**
- Consumes: `ZoneGrid`, `ValutazioneButtons` da `@/components/*`, `GiocatoreInCampo` da `@/features/live-scouting/RicezioneFlow` (Task 19), `squadraOpposta` da `@/domain/reducer`.
- Produces: `<AttaccoMuroFlow mostraBivio giocatoriInCampo onCompleta={(dati: DatiAttaccoMuro) => void} />` da `@/features/live-scouting/AttaccoMuroFlow` (interfaccia `DatiAttaccoMuro = { fondamentale: 'attacco' | 'muro', giocatoreId, valutazione, zona, direzione }`).

- [ ] **Step 1: Esporta `squadraOpposta` da `src/domain/reducer.ts`**

Cambia la riga `function squadraOpposta(squadra: Squadra): Squadra {` in:

```ts
export function squadraOpposta(squadra: Squadra): Squadra {
```

- [ ] **Step 2: Aggiungi il test in `src/domain/reducer.test.ts`**

Aggiungi, dentro il blocco `describe('deriveSetState', ...)` o come nuovo `describe` separato nello stesso file:

```ts
describe('squadraOpposta', () => {
  it('restituisce la squadra avversaria', () => {
    expect(squadraOpposta('A')).toBe('B');
    expect(squadraOpposta('B')).toBe('A');
  });
});
```

Aggiungi `squadraOpposta` all'import da `./reducer` in cima al file.

- [ ] **Step 3: Esegui i test**

Run: `npm test -- reducer`
Expected: PASS.

- [ ] **Step 4: Crea `src/features/live-scouting/AttaccoMuroFlow.tsx`**

```tsx
import { useState } from 'react';
import type { Valutazione } from '@/domain/types';
import { ZoneGrid } from '@/components/ZoneGrid';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';
import type { GiocatoreInCampo } from './RicezioneFlow';

export interface DatiAttaccoMuro {
  fondamentale: 'attacco' | 'muro';
  giocatoreId: string;
  valutazione: Valutazione;
  zona: number;
  direzione: number;
}

type Passo = 'bivio' | 'giocatore' | 'valutazione' | 'zona' | 'direzione';

export function AttaccoMuroFlow({
  mostraBivio,
  giocatoriInCampo,
  onCompleta,
}: {
  mostraBivio: boolean;
  giocatoriInCampo: GiocatoreInCampo[];
  onCompleta: (dati: DatiAttaccoMuro) => void;
}) {
  const [passo, setPasso] = useState<Passo>(mostraBivio ? 'bivio' : 'giocatore');
  const [fondamentale, setFondamentale] = useState<'attacco' | 'muro'>('attacco');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [zona, setZona] = useState<number | null>(null);

  if (passo === 'bivio') {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setFondamentale('muro');
            setPasso('giocatore');
          }}
          className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white"
        >
          Muro
        </button>
        <button
          type="button"
          onClick={() => {
            setFondamentale('attacco');
            setPasso('giocatore');
          }}
          className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white"
        >
          Attacco
        </button>
      </div>
    );
  }

  if (passo === 'giocatore') {
    return (
      <div className="grid grid-cols-3 gap-3">
        {giocatoriInCampo.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGiocatoreId(g.id);
              setPasso('valutazione');
            }}
            className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
          >
            #{g.numero} {g.nome}
          </button>
        ))}
      </div>
    );
  }

  if (passo === 'valutazione') {
    return (
      <ValutazioneButtons
        onSeleziona={(v) => {
          setValutazione(v);
          setPasso('zona');
        }}
      />
    );
  }

  if (passo === 'zona') {
    return (
      <ZoneGrid
        variante="origine"
        onSeleziona={(z) => {
          setZona(z);
          setPasso('direzione');
        }}
      />
    );
  }

  return (
    <ZoneGrid
      variante="destinazione"
      onSeleziona={(direzione) => {
        onCompleta({ fondamentale, giocatoreId: giocatoreId!, valutazione: valutazione!, zona: zona!, direzione });
      }}
    />
  );
}
```

- [ ] **Step 5: Scrivi il test `src/features/live-scouting/AttaccoMuroFlow.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';

const giocatori = [{ id: 'p1', numero: 9, nome: 'Neri' }];

describe('AttaccoMuroFlow', () => {
  it('quando mostraBivio è falso parte direttamente da attacco senza mostrare il bivio', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow mostraBivio={false} giocatoriInCampo={giocatori} onCompleta={onCompleta} />);

    expect(screen.queryByText('Muro')).not.toBeInTheDocument();
    await user.click(screen.getByText('#9 Neri'));
    await user.click(screen.getByText('#'));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByRole('button');
    await user.click(celleDirezione[0]);

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'attacco', giocatoreId: 'p1', valutazione: '#', zona: 4, direzione: 7,
    });
  });

  it('quando mostraBivio è vero mostra prima la scelta Muro/Attacco', async () => {
    const onCompleta = vi.fn();
    const user = userEvent.setup();
    render(<AttaccoMuroFlow mostraBivio giocatoriInCampo={giocatori} onCompleta={onCompleta} />);

    await user.click(screen.getByText('Muro'));
    await user.click(screen.getByText('#9 Neri'));
    await user.click(screen.getByText('='));
    const celleZona = screen.getAllByRole('button');
    await user.click(celleZona[0]);
    const celleDirezione = screen.getAllByRole('button');
    await user.click(celleDirezione[0]);

    expect(onCompleta).toHaveBeenCalledWith({
      fondamentale: 'muro', giocatoreId: 'p1', valutazione: '=', zona: 4, direzione: 7,
    });
  });
});
```

- [ ] **Step 6: Esegui i test**

Run: `npm test -- AttaccoMuroFlow`
Expected: PASS.

- [ ] **Step 7: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per innestare `AttaccoMuroFlow`**

Aggiungi gli import:

```tsx
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import { squadraOpposta } from '@/domain/reducer';
```

Aggiungi, subito dopo il calcolo di `giocatoriInCampoRicezione`, il calcolo della squadra protagonista di attacco/muro:

```tsx
const ultimaAzioneRallyAperto = azioniRallyAperto.at(-1);
const squadraProtagonista = ultimaAzioneRallyAperto
  ? passoAtteso === 'attacco'
    ? ultimaAzioneRallyAperto.squadra
    : squadraOpposta(ultimaAzioneRallyAperto.squadra)
  : null;
const rotazioneProtagonista =
  squadraProtagonista === 'A' ? derivato.rotazioneA : squadraProtagonista === 'B' ? derivato.rotazioneB : [];
const giocatoriInCampoAttaccoMuro = rotazioneProtagonista
  .map((id) => giocatori?.find((g) => g.id === id))
  .filter((g): g is NonNullable<typeof g> => Boolean(g));
```

Sostituisci il blocco finale (il rendering condizionale di `RicezioneFlow` seguito dal paragrafo segnaposto) con:

```tsx
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
      })
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
      })
    }
  />
)}
```

(rimuovi completamente il vecchio `<p className="text-lg">Prossimo fondamentale atteso: {passoAtteso}</p>` di fallback: ora tutti e 4 gli stati di `passoAtteso` sono coperti da un componente di tap-flow dedicato)

- [ ] **Step 8: Esegui i test**

Run: `npm test`
Expected: PASS — l'intera suite passa.

- [ ] **Step 9: Commit**

```bash
git add src/domain/reducer.ts src/domain/reducer.test.ts src/features/live-scouting/AttaccoMuroFlow.tsx src/features/live-scouting/AttaccoMuroFlow.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx
git commit -m "feat: wire the attacco/muro tap-flow with the transition fork"
```

### Task 21: Sostituzioni e timeout

**Files:**
- Create: `src/features/live-scouting/SubstitutionModal.tsx`
- Test: `src/features/live-scouting/SubstitutionModal.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (pulsanti Sostituzione/Timeout e apertura del modal)
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx` (nuovo test di integrazione della sostituzione)

**Interfaces:**
- Consumes: `GiocatoreInCampo` da `@/features/live-scouting/RicezioneFlow`, tipo `Squadra` da `@/domain/types`.
- Produces: `<SubstitutionModal inCampoA inCampoB panchinaA panchinaB onConferma={(dati: DatiSostituzione) => void} onChiudi={() => void} />` da `@/features/live-scouting/SubstitutionModal`.

- [ ] **Step 1: Crea `src/features/live-scouting/SubstitutionModal.tsx`**

```tsx
import { useState } from 'react';
import type { Squadra } from '@/domain/types';
import type { GiocatoreInCampo } from './RicezioneFlow';

export interface DatiSostituzione {
  squadra: Squadra;
  giocatoreEsceId: string;
  giocatoreEntraId: string;
}

export function SubstitutionModal({
  inCampoA,
  inCampoB,
  panchinaA,
  panchinaB,
  onConferma,
  onChiudi,
}: {
  inCampoA: GiocatoreInCampo[];
  inCampoB: GiocatoreInCampo[];
  panchinaA: GiocatoreInCampo[];
  panchinaB: GiocatoreInCampo[];
  onConferma: (dati: DatiSostituzione) => void;
  onChiudi: () => void;
}) {
  const [squadra, setSquadra] = useState<Squadra>('A');
  const [giocatoreEsceId, setGiocatoreEsceId] = useState('');
  const [giocatoreEntraId, setGiocatoreEntraId] = useState('');

  const inCampo = squadra === 'A' ? inCampoA : inCampoB;
  const panchina = squadra === 'A' ? panchinaA : panchinaB;

  function handleConferma() {
    if (!giocatoreEsceId || !giocatoreEntraId) return;
    onConferma({ squadra, giocatoreEsceId, giocatoreEntraId });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70" data-testid="modal-sostituzione">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-white">
        <h2 className="mb-4 text-xl font-bold">Sostituzione</h2>
        <div className="mb-4 flex gap-3">
          <button type="button" onClick={() => setSquadra('A')} className={`rounded-lg px-4 py-2 ${squadra === 'A' ? 'bg-blue-700' : 'bg-slate-700'}`}>
            Squadra A
          </button>
          <button type="button" onClick={() => setSquadra('B')} className={`rounded-lg px-4 py-2 ${squadra === 'B' ? 'bg-blue-700' : 'bg-slate-700'}`}>
            Squadra B
          </button>
        </div>
        <label className="mb-3 block">
          Esce
          <select
            value={giocatoreEsceId}
            onChange={(e) => setGiocatoreEsceId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3"
          >
            <option value="">Seleziona...</option>
            {inCampo.map((g) => (
              <option key={g.id} value={g.id}>#{g.numero} {g.nome}</option>
            ))}
          </select>
        </label>
        <label className="mb-4 block">
          Entra
          <select
            value={giocatoreEntraId}
            onChange={(e) => setGiocatoreEntraId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3"
          >
            <option value="">Seleziona...</option>
            {panchina.map((g) => (
              <option key={g.id} value={g.id}>#{g.numero} {g.nome}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2">
            Annulla
          </button>
          <button type="button" onClick={handleConferma} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold">
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Scrivi il test `src/features/live-scouting/SubstitutionModal.test.tsx`**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubstitutionModal } from './SubstitutionModal';

describe('SubstitutionModal', () => {
  it('conferma una sostituzione per la squadra selezionata', async () => {
    const onConferma = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal
        inCampoA={[{ id: 'a3', numero: 3, nome: 'Verdi' }]}
        inCampoB={[]}
        panchinaA={[{ id: 'libero1', numero: 15, nome: 'Neri' }]}
        panchinaB={[]}
        onConferma={onConferma}
        onChiudi={() => {}}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Esce'), 'a3');
    await user.selectOptions(screen.getByLabelText('Entra'), 'libero1');
    await user.click(screen.getByRole('button', { name: 'Conferma' }));

    expect(onConferma).toHaveBeenCalledWith({ squadra: 'A', giocatoreEsceId: 'a3', giocatoreEntraId: 'libero1' });
  });

  it('chiama onChiudi quando si annulla', async () => {
    const onChiudi = vi.fn();
    const user = userEvent.setup();
    render(
      <SubstitutionModal inCampoA={[]} inCampoB={[]} panchinaA={[]} panchinaB={[]} onConferma={() => {}} onChiudi={onChiudi} />,
    );
    await user.click(screen.getByRole('button', { name: 'Annulla' }));
    expect(onChiudi).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- SubstitutionModal`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per innestare pulsanti Sostituzione/Timeout**

Cambia l'import di React in cima al file da `import { useEffect } from 'react';` a:

```tsx
import { useEffect, useState } from 'react';
```

Aggiungi l'import:

```tsx
import { SubstitutionModal } from './SubstitutionModal';
```

Aggiungi i selettori dello store accanto agli altri:

```tsx
const aggiungiSostituzione = useLiveMatchStore((s) => s.aggiungiSostituzione);
const aggiungiTimeout = useLiveMatchStore((s) => s.aggiungiTimeout);
```

Aggiungi lo stato locale del modal (subito dopo le dichiarazioni degli hook, prima del controllo `if (!derivato)`):

```tsx
const [sostituzioneAperta, setSostituzioneAperta] = useState(false);
```

Subito prima del `return` del componente (dopo il calcolo di `giocatoriInCampoAttaccoMuro`), aggiungi il calcolo di formazioni in campo e panchine complete:

```tsx
const inCampoA = derivato.rotazioneA
  .map((id) => giocatori?.find((g) => g.id === id))
  .filter((g): g is NonNullable<typeof g> => Boolean(g));
const inCampoB = derivato.rotazioneB
  .map((id) => giocatori?.find((g) => g.id === id))
  .filter((g): g is NonNullable<typeof g> => Boolean(g));
const panchinaA = (giocatori ?? []).filter(
  (g) => g.teamId === match?.squadraAId && g.attivo && !derivato.rotazioneA.includes(g.id),
);
const panchinaB = (giocatori ?? []).filter(
  (g) => g.teamId === match?.squadraBId && g.attivo && !derivato.rotazioneB.includes(g.id),
);
```

Aggiungi un pulsante "Sostituzione" e due pulsanti "Timeout A"/"Timeout B" nell'header, accanto ai pulsanti "Punto A"/"Punto B":

```tsx
<button
  type="button"
  onClick={() => setSostituzioneAperta(true)}
  className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
>
  Sostituzione
</button>
<button type="button" onClick={() => aggiungiTimeout('A')} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
  Timeout A
</button>
<button type="button" onClick={() => aggiungiTimeout('B')} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
  Timeout B
</button>
```

Aggiungi, subito prima del tag `</main>` di chiusura, il rendering condizionale del modal:

```tsx
{sostituzioneAperta && (
  <SubstitutionModal
    inCampoA={inCampoA}
    inCampoB={inCampoB}
    panchinaA={panchinaA}
    panchinaB={panchinaB}
    onConferma={(dati) => {
      aggiungiSostituzione(dati);
      setSostituzioneAperta(false);
    }}
    onChiudi={() => setSostituzioneAperta(false)}
  />
)}
```

- [ ] **Step 5: Aggiungi un nuovo test in `src/features/live-scouting/LiveScoutingScreen.test.tsx`**

Aggiungi, dentro il blocco `describe('LiveScoutingScreen', ...)`, dopo gli altri test:

```tsx
it('esegue una sostituzione e aggiorna la formazione in campo mostrata', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
  const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
  const liberoPanchina = await aggiungiGiocatore({ teamId: squadraA.id, numero: 15, nome: 'Libero1', ruolo: 'libero' });
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: giocatoriA.map((g) => g.id),
    formazioneInizialeB: giocatoriB.map((g) => g.id),
    primaSquadraAlServizio: 'A',
  });
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
      <Routes>
        <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByTestId('punteggio');
  await user.click(screen.getByRole('button', { name: 'Sostituzione' }));
  await screen.findByTestId('modal-sostituzione');
  await user.selectOptions(screen.getByLabelText('Esce'), giocatoriA[2].id);
  await user.selectOptions(screen.getByLabelText('Entra'), liberoPanchina.id);
  await user.click(screen.getByRole('button', { name: 'Conferma' }));

  expect(screen.queryByTestId('modal-sostituzione')).not.toBeInTheDocument();
  expect(screen.getByTestId('rotazione-a')).toHaveTextContent('P3: #15 Libero1');
});
```

- [ ] **Step 6: Esegui i test**

Run: `npm test -- LiveScoutingScreen SubstitutionModal`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/live-scouting/SubstitutionModal.tsx src/features/live-scouting/SubstitutionModal.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: add substitution modal and timeout buttons to the live scouting screen"
```

### Task 22: Chiusura set/partita (banner e controlli manuali)

**Files:**
- Modify: `src/features/match-setup/LineupPicker.tsx` (numero set calcolato dinamicamente invece di essere fisso a 1)
- Modify: `src/features/match-setup/LineupPicker.test.tsx` (nuovo test sul numero del set successivo)
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (banner fine set, pulsanti "Chiudi set"/"Chiudi partita")
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx` (nuovi test di chiusura set/partita)

**Interfaces:**
- Consumes: `aggiornaStatoSet`, `aggiornaStatoPartita` da `@/db/matches` (Task 5).
- Produces: comportamento di chiusura set/partita raggiungibile dalla schermata di scouting; naviga a `/partite/:matchId/formazione` dopo la chiusura di un set (rotta Task 14) e a `/storico` dopo la chiusura della partita (rotta creata nel Task 25).

- [ ] **Step 1: Correggi il numero di set in `src/features/match-setup/LineupPicker.tsx`**

Aggiungi, subito dopo la dichiarazione di `giocatoriB`, il conteggio dei set già esistenti per la partita:

```tsx
const setsEsistenti = useLiveQuery(
  () => (matchId ? db.sets.where('matchId').equals(matchId).count() : 0),
  [matchId],
);
```

Nella funzione `handleContinua`, sostituisci `numero: 1,` con:

```tsx
numero: (setsEsistenti ?? 0) + 1,
```

- [ ] **Step 2: Aggiungi il test in `src/features/match-setup/LineupPicker.test.tsx`**

Aggiungi, dentro il blocco `describe('LineupPicker', ...)`, dopo il test esistente:

```tsx
it('assegna il numero 2 al secondo set della stessa partita', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  await creaRosterDaSei(squadraA.id, 'A');
  await creaRosterDaSei(squadraB.id, 'B');
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  await db.sets.add({
    id: 'set-esistente', matchId: match.id, numero: 1,
    formazioneInizialeA: [], formazioneInizialeB: [], primaSquadraAlServizio: 'A',
    stato: 'concluso', vincitore: 'A',
  });
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/formazione`]}>
      <Routes>
        <Route path="/partite/:matchId/formazione" element={<LineupPicker />} />
        <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting avviato</div>} />
      </Routes>
    </MemoryRouter>,
  );

  for (let i = 1; i <= 6; i += 1) {
    await user.click(await screen.findByText(new RegExp(`#${i} A${i}`)));
    await user.click(await screen.findByText(new RegExp(`#${i} B${i}`)));
  }
  await user.click(screen.getByRole('button', { name: 'Inizia partita' }));

  await screen.findByText('Scouting avviato');
  const nuovoSet = (await db.sets.toArray()).find((s) => s.id !== 'set-esistente');
  expect(nuovoSet?.numero).toBe(2);
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- LineupPicker`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per la chiusura set/partita**

Cambia l'import da `react-router-dom` da `import { useParams } from 'react-router-dom';` a:

```tsx
import { useNavigate, useParams } from 'react-router-dom';
```

Aggiungi l'import:

```tsx
import { aggiornaStatoSet, aggiornaStatoPartita } from '@/db/matches';
```

Aggiungi, subito dopo `const { matchId, setId } = useParams...`:

```tsx
const navigate = useNavigate();
```

Subito prima del `return` del componente, aggiungi il calcolo del target punti e le funzioni di chiusura:

```tsx
const formatoSet = match?.formatoSet ?? 5;
const setDecisivo = setRecord?.numero === formatoSet;
const targetPunti = setDecisivo ? (match?.puntiSetDecisivo ?? 15) : (match?.puntiSet ?? 25);
const setAlPunto =
  (derivato.punteggioA >= targetPunti || derivato.punteggioB >= targetPunti) &&
  Math.abs(derivato.punteggioA - derivato.punteggioB) >= 2;

async function handleChiudiSet() {
  if (!setRecord || derivato.punteggioA === derivato.punteggioB) return;
  const vincitore = derivato.punteggioA > derivato.punteggioB ? 'A' : 'B';
  await aggiornaStatoSet(setRecord.id, 'concluso', vincitore);
  navigate(`/partite/${matchId}/formazione`);
}

async function handleChiudiPartita() {
  if (!matchId) return;
  await aggiornaStatoPartita(matchId, 'conclusa');
  navigate('/storico');
}
```

Aggiungi, subito dopo i pulsanti "Timeout A"/"Timeout B" già presenti nell'header, i due nuovi pulsanti:

```tsx
<button type="button" onClick={handleChiudiSet} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
  Chiudi set
</button>
<button type="button" onClick={handleChiudiPartita} className="rounded-lg bg-red-900 px-4 py-2 text-sm">
  Chiudi partita
</button>
```

Aggiungi il banner non bloccante, subito dopo il tag `</header>` di chiusura e prima della `<section>` con le formazioni in campo:

```tsx
{setAlPunto && (
  <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-700 px-4 py-3" data-testid="banner-fine-set">
    <span>
      Set al punto {derivato.punteggioA}-{derivato.punteggioB} — chiudere?
    </span>
    <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-amber-900 px-4 py-2 font-semibold">
      Chiudi set
    </button>
  </div>
)}
```

- [ ] **Step 5: Aggiungi i nuovi test in `src/features/live-scouting/LiveScoutingScreen.test.tsx`**

Cambia la riga di import `import { render, screen } from '@testing-library/react';` in:

```tsx
import { render, screen, act } from '@testing-library/react';
```

Aggiungi, dentro il blocco `describe('LiveScoutingScreen', ...)`, dopo gli altri test:

```tsx
it('mostra il banner di fine set al raggiungimento del punteggio target e permette di chiuderlo', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
  const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: giocatoriA.map((g) => g.id),
    formazioneInizialeB: giocatoriB.map((g) => g.id),
    primaSquadraAlServizio: 'A',
  });

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
      <Routes>
        <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
        <Route path="/partite/:matchId/formazione" element={<div>Formazione</div>} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByTestId('punteggio');
  await act(async () => {
    for (let i = 0; i < 25; i += 1) {
      await useLiveMatchStore.getState().chiudiRallyManuale('punto_A');
    }
  });

  expect(await screen.findByTestId('banner-fine-set')).toBeInTheDocument();
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Chiudi set' }));

  expect(await screen.findByText('Formazione')).toBeInTheDocument();
  const setAggiornato = await db.sets.get(set.id);
  expect(setAggiornato?.stato).toBe('concluso');
  expect(setAggiornato?.vincitore).toBe('A');
});

it('chiude la partita e ne aggiorna lo stato', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
  const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: giocatoriA.map((g) => g.id),
    formazioneInizialeB: giocatoriB.map((g) => g.id),
    primaSquadraAlServizio: 'A',
  });
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
      <Routes>
        <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByTestId('punteggio');
  await user.click(screen.getByRole('button', { name: 'Chiudi partita' }));

  const partitaAggiornata = await db.matches.get(match.id);
  expect(partitaAggiornata?.stato).toBe('conclusa');
});
```

- [ ] **Step 6: Esegui i test**

Run: `npm test -- LiveScoutingScreen LineupPicker`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/match-setup/LineupPicker.tsx src/features/match-setup/LineupPicker.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: add flexible set/match closing with non-blocking target-score banner"
```

### Task 23: Dashboard statistiche live

**Files:**
- Create: `src/features/stats-dashboard/StatsPanel.tsx`
- Test: `src/features/stats-dashboard/StatsPanel.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (pulsante "Statistiche" e overlay)
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx` (nuovo test di integrazione)

**Interfaces:**
- Consumes: `calcolaStatistiche` da `@/domain/stats` (Task 9), `GiocatoreInCampo` da `@/features/live-scouting/RicezioneFlow`.
- Produces: `<StatsPanel azioni giocatoriA giocatoriB onChiudi={() => void} />` da `@/features/stats-dashboard/StatsPanel`.

- [ ] **Step 1: Crea `src/features/stats-dashboard/StatsPanel.tsx`**

```tsx
import { calcolaStatistiche } from '@/domain/stats';
import type { Azione, Fondamentale } from '@/domain/types';
import type { GiocatoreInCampo } from '@/features/live-scouting/RicezioneFlow';

const FONDAMENTALI: Fondamentale[] = ['battuta', 'ricezione', 'attacco', 'muro'];

export function StatsPanel({
  azioni,
  giocatoriA,
  giocatoriB,
  onChiudi,
}: {
  azioni: Azione[];
  giocatoriA: GiocatoreInCampo[];
  giocatoriB: GiocatoreInCampo[];
  onChiudi: () => void;
}) {
  const squadre = [
    { titolo: 'Squadra A', giocatori: giocatoriA },
    { titolo: 'Squadra B', giocatori: giocatoriB },
  ];

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/80 p-6 text-white" data-testid="pannello-statistiche">
      <div className="mx-auto max-w-3xl rounded-xl bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Statistiche live</h2>
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2">
            Chiudi
          </button>
        </div>
        {squadre.map(({ titolo, giocatori }) => (
          <div key={titolo} className="mb-6">
            <h3 className="mb-2 text-xl font-semibold">{titolo}</h3>
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2">Giocatore</th>
                  {FONDAMENTALI.map((f) => (
                    <th key={f} className="pb-2 capitalize">{f}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {giocatori.map((g) => (
                  <tr key={g.id} className="border-t border-slate-700">
                    <td className="py-2">#{g.numero} {g.nome}</td>
                    {FONDAMENTALI.map((f) => {
                      const stats = calcolaStatistiche(azioni, f, g.id);
                      return (
                        <td key={f} className="py-2" data-testid={`stat-${g.id}-${f}`}>
                          {stats.tentativi > 0 ? `${stats.efficienzaPercento.toFixed(0)}% (${stats.tentativi})` : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Scrivi il test `src/features/stats-dashboard/StatsPanel.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsPanel } from './StatsPanel';
import type { Azione } from '@/domain/types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

describe('StatsPanel', () => {
  it('mostra efficienza e tentativi per fondamentale e giocatore', () => {
    const azioni = [
      creaAzione({ id: 'az1', giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '#' }),
      creaAzione({ id: 'az2', giocatoreId: 'p1', fondamentale: 'attacco', valutazione: '=' }),
    ];
    render(
      <StatsPanel
        azioni={azioni}
        giocatoriA={[{ id: 'p1', numero: 9, nome: 'Neri' }]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('stat-p1-attacco')).toHaveTextContent('0% (2)');
    expect(screen.getByTestId('stat-p1-battuta')).toHaveTextContent('—');
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- StatsPanel`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per innestare `StatsPanel`**

Aggiungi l'import:

```tsx
import { StatsPanel } from '@/features/stats-dashboard/StatsPanel';
```

Aggiungi lo stato locale, accanto a `sostituzioneAperta`:

```tsx
const [statisticheAperte, setStatisticheAperte] = useState(false);
```

Subito dopo il calcolo di `panchinaB`, aggiungi i roster completi per squadra:

```tsx
const rosterA = (giocatori ?? []).filter((g) => g.teamId === match?.squadraAId);
const rosterB = (giocatori ?? []).filter((g) => g.teamId === match?.squadraBId);
```

Aggiungi un pulsante "Statistiche" nell'header, accanto al pulsante "Sostituzione":

```tsx
<button
  type="button"
  onClick={() => setStatisticheAperte(true)}
  className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
>
  Statistiche
</button>
```

Aggiungi, accanto al blocco condizionale di `SubstitutionModal` prima del tag `</main>` di chiusura:

```tsx
{statisticheAperte && (
  <StatsPanel
    azioni={azioni}
    giocatoriA={rosterA}
    giocatoriB={rosterB}
    onChiudi={() => setStatisticheAperte(false)}
  />
)}
```

- [ ] **Step 5: Aggiungi un nuovo test in `src/features/live-scouting/LiveScoutingScreen.test.tsx`**

Aggiungi, dentro il blocco `describe('LiveScoutingScreen', ...)`, dopo gli altri test:

```tsx
it('apre il pannello statistiche e mostra le azioni registrate', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
  const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: giocatoriA.map((g) => g.id),
    formazioneInizialeB: giocatoriB.map((g) => g.id),
    primaSquadraAlServizio: 'A',
  });
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
      <Routes>
        <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByText('Flottante');
  await user.click(screen.getByText('Flottante'));
  await user.click(screen.getByText('#'));
  let celle = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
  await user.click(celle[0]);
  celle = screen.getAllByTestId('zone-grid')[0].querySelectorAll('button');
  await user.click(celle[0]);
  await screen.findByTestId('punteggio');

  await user.click(screen.getByRole('button', { name: 'Statistiche' }));

  expect(await screen.findByTestId(`stat-${giocatoriA[0].id}-battuta`)).toHaveTextContent('100% (1)');
});
```

- [ ] **Step 6: Esegui i test**

Run: `npm test -- LiveScoutingScreen StatsPanel`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/stats-dashboard/StatsPanel.tsx src/features/stats-dashboard/StatsPanel.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: add live stats dashboard panel"
```

### Task 24: Pannello Analisi live

**Files:**
- Create: `src/features/live-analysis/LiveAnalysisPanel.tsx`
- Test: `src/features/live-analysis/LiveAnalysisPanel.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (pulsante "Analisi live" e overlay)
- Modify: `src/features/live-scouting/LiveScoutingScreen.test.tsx` (nuovo test di integrazione)

**Interfaces:**
- Consumes: `analizzaTendenze`, `distribuzioneDirezioniAttacco` da `@/domain/analysis` (Task 10), tipi `Azione`/`Player` da `@/domain/types`.
- Produces: `<LiveAnalysisPanel azioni giocatoriA giocatoriB onChiudi={() => void} />` da `@/features/live-analysis/LiveAnalysisPanel`.

- [ ] **Step 1: Crea `src/features/live-analysis/LiveAnalysisPanel.tsx`**

```tsx
import { analizzaTendenze, distribuzioneDirezioniAttacco } from '@/domain/analysis';
import type { Azione, Player } from '@/domain/types';

const ZONE_CENTRALE = [6, 5, 1];

function RigaGiocatore({ giocatore, azioni }: { giocatore: Player; azioni: Azione[] }) {
  const tendenze = analizzaTendenze(azioni, giocatore.id);

  if (tendenze.tentativi === 0) {
    return (
      <tr className="border-t border-slate-700">
        <td className="py-2">#{giocatore.numero} {giocatore.nome}</td>
        <td className="py-2 text-slate-500" colSpan={2}>Nessun attacco registrato</td>
      </tr>
    );
  }

  const classeAllerta = tendenze.allerta ? 'bg-red-900/40' : '';

  if (giocatore.ruolo === 'centrale') {
    const distribuzione = distribuzioneDirezioniAttacco(azioni, giocatore.id);
    const testoZone = ZONE_CENTRALE.map(
      (z) => `zona ${z}: ${(((distribuzione[z] ?? 0) / tendenze.tentativi) * 100).toFixed(0)}%`,
    ).join(', ');
    return (
      <tr className={`border-t border-slate-700 ${classeAllerta}`}>
        <td className="py-2">#{giocatore.numero} {giocatore.nome}</td>
        <td className="py-2" data-testid={`analisi-${giocatore.id}`}>{testoZone}</td>
        <td className="py-2">Errore+murato: {(tendenze.percErrore + tendenze.percMurato).toFixed(0)}%</td>
      </tr>
    );
  }

  return (
    <tr className={`border-t border-slate-700 ${classeAllerta}`}>
      <td className="py-2">#{giocatore.numero} {giocatore.nome}</td>
      <td className="py-2" data-testid={`analisi-${giocatore.id}`}>
        Colpo principale: {tendenze.colpoPrincipale} (parallela {tendenze.percParallela.toFixed(0)}%, diagonale{' '}
        {tendenze.percDiagonale.toFixed(0)}%, centro {tendenze.percCentro.toFixed(0)}%)
      </td>
      <td className="py-2">Errore+murato: {(tendenze.percErrore + tendenze.percMurato).toFixed(0)}%</td>
    </tr>
  );
}

export function LiveAnalysisPanel({
  azioni,
  giocatoriA,
  giocatoriB,
  onChiudi,
}: {
  azioni: Azione[];
  giocatoriA: Player[];
  giocatoriB: Player[];
  onChiudi: () => void;
}) {
  const squadre = [
    { titolo: 'Squadra A', giocatori: giocatoriA },
    { titolo: 'Squadra B', giocatori: giocatoriB },
  ];

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/80 p-6 text-white" data-testid="pannello-analisi-live">
      <div className="mx-auto max-w-3xl rounded-xl bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analisi live</h2>
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2">
            Chiudi
          </button>
        </div>
        {squadre.map(({ titolo, giocatori }) => (
          <div key={titolo} className="mb-6">
            <h3 className="mb-2 text-xl font-semibold">{titolo}</h3>
            <table className="w-full text-left text-sm">
              <tbody>
                {giocatori.map((g) => (
                  <RigaGiocatore key={g.id} giocatore={g} azioni={azioni} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Scrivi il test `src/features/live-analysis/LiveAnalysisPanel.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveAnalysisPanel } from './LiveAnalysisPanel';
import type { Azione, Player } from '@/domain/types';

function creaAzione(overrides: Partial<Azione>): Azione {
  return {
    id: 'az', rallyId: 'r1', setId: 'set1', ordine: 1, squadra: 'A', giocatoreId: 'p1',
    fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
    timestamp: '2026-09-16T10:00:00.000Z', ...overrides,
  };
}

function creaGiocatore(overrides: Partial<Player>): Player {
  return { id: 'p1', teamId: 't1', numero: 9, nome: 'Neri', ruolo: 'schiacciatore', attivo: true, ...overrides };
}

describe('LiveAnalysisPanel', () => {
  it('mostra il colpo principale per uno schiacciatore', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', zona: 4, direzione: 5 }),
      creaAzione({ id: 'a2', rallyId: 'r2', zona: 4, direzione: 5, valutazione: '+' }),
      creaAzione({ id: 'a3', rallyId: 'r3', zona: 4, direzione: 1, valutazione: '=' }),
    ];
    render(
      <LiveAnalysisPanel azioni={azioni} giocatoriA={[creaGiocatore({})]} giocatoriB={[]} onChiudi={() => {}} />,
    );
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('Colpo principale: parallela');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('parallela 67%');
  });

  it('mostra il breakdown per zona 6/5/1 per un centrale', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', direzione: 6 }),
      creaAzione({ id: 'a2', rallyId: 'r2', direzione: 6 }),
      creaAzione({ id: 'a3', rallyId: 'r3', direzione: 5 }),
    ];
    render(
      <LiveAnalysisPanel
        azioni={azioni}
        giocatoriA={[creaGiocatore({ ruolo: 'centrale' })]}
        giocatoriB={[]}
        onChiudi={() => {}}
      />,
    );
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('zona 6: 67%');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('zona 5: 33%');
    expect(screen.getByTestId('analisi-p1')).toHaveTextContent('zona 1: 0%');
  });

  it('evidenzia la riga quando errori e murati superano la soglia di allerta', () => {
    const azioni = [
      creaAzione({ id: 'a1', rallyId: 'r1', valutazione: '=' }),
      creaAzione({ id: 'a2', rallyId: 'r2', valutazione: '#' }),
    ];
    render(
      <LiveAnalysisPanel azioni={azioni} giocatoriA={[creaGiocatore({})]} giocatoriB={[]} onChiudi={() => {}} />,
    );
    const riga = screen.getByTestId('analisi-p1').closest('tr');
    expect(riga?.className).toContain('bg-red-900/40');
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- LiveAnalysisPanel`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/live-scouting/LiveScoutingScreen.tsx` per innestare `LiveAnalysisPanel`**

Aggiungi l'import:

```tsx
import { LiveAnalysisPanel } from '@/features/live-analysis/LiveAnalysisPanel';
```

Aggiungi lo stato locale, accanto a `statisticheAperte`:

```tsx
const [analisiAperta, setAnalisiAperta] = useState(false);
```

Aggiungi un pulsante "Analisi live" nell'header, accanto al pulsante "Statistiche":

```tsx
<button
  type="button"
  onClick={() => setAnalisiAperta(true)}
  className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
>
  Analisi live
</button>
```

Aggiungi, accanto al blocco condizionale di `StatsPanel` prima del tag `</main>` di chiusura:

```tsx
{analisiAperta && (
  <LiveAnalysisPanel
    azioni={azioni}
    giocatoriA={rosterA}
    giocatoriB={rosterB}
    onChiudi={() => setAnalisiAperta(false)}
  />
)}
```

- [ ] **Step 5: Aggiungi un nuovo test in `src/features/live-scouting/LiveScoutingScreen.test.tsx`**

Aggiungi, dentro il blocco `describe('LiveScoutingScreen', ...)`, dopo gli altri test:

```tsx
it('apre il pannello Analisi live', async () => {
  const squadraA = await creaSquadra('Volley Rossi');
  const squadraB = await creaSquadra('Volley Blu');
  const giocatoriA = await creaRosterDaSei(squadraA.id, 'A');
  const giocatoriB = await creaRosterDaSei(squadraB.id, 'B');
  const match = await creaPartita({
    data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
    squadraRiferimentoId: squadraA.id, formatoSet: 5, puntiSet: 25, puntiSetDecisivo: 15,
  });
  const set = await creaSet({
    matchId: match.id, numero: 1,
    formazioneInizialeA: giocatoriA.map((g) => g.id),
    formazioneInizialeB: giocatoriB.map((g) => g.id),
    primaSquadraAlServizio: 'A',
  });
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={[`/partite/${match.id}/scouting/${set.id}`]}>
      <Routes>
        <Route path="/partite/:matchId/scouting/:setId" element={<LiveScoutingScreen />} />
      </Routes>
    </MemoryRouter>,
  );

  await screen.findByTestId('punteggio');
  await user.click(screen.getByRole('button', { name: 'Analisi live' }));

  expect(await screen.findByTestId('pannello-analisi-live')).toBeInTheDocument();
});
```

- [ ] **Step 6: Esegui i test**

Run: `npm test -- LiveScoutingScreen LiveAnalysisPanel`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/live-analysis/LiveAnalysisPanel.tsx src/features/live-analysis/LiveAnalysisPanel.test.tsx src/features/live-scouting/LiveScoutingScreen.tsx src/features/live-scouting/LiveScoutingScreen.test.tsx
git commit -m "feat: add live analysis panel with attack tendencies and middle-blocker zone breakdown"
```

### Task 25: Storico partite — lista e ripresa partita in corso

**Files:**
- Create: `src/features/history/HistoryListPage.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/storico`)
- Test: `src/features/history/HistoryListPage.test.tsx`

**Interfaces:**
- Consumes: `db` da `@/db/schema`.
- Produces: rotta `/storico` (destinazione della "Chiudi partita" del Task 22); naviga a `/partite/:matchId/formazione`, `/partite/:matchId/scouting/:setId` o `/storico/:matchId` (rotta creata nel Task 26).

- [ ] **Step 1: Crea `src/features/history/HistoryListPage.tsx`**

```tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db/schema';

export function HistoryListPage() {
  const navigate = useNavigate();
  const partite = useLiveQuery(() => db.matches.orderBy('data').reverse().toArray(), []);
  const squadre = useLiveQuery(() => db.teams.toArray(), []);

  function nomeSquadra(id: string) {
    return squadre?.find((s) => s.id === id)?.nome ?? id;
  }

  async function handleApri(matchId: string, stato: string) {
    if (stato === 'conclusa') {
      navigate(`/storico/${matchId}`);
      return;
    }
    const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
    const ultimoSet = sets.at(-1);
    if (!ultimoSet || ultimoSet.stato === 'concluso') {
      navigate(`/partite/${matchId}/formazione`);
    } else {
      navigate(`/partite/${matchId}/scouting/${ultimoSet.id}`);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold">Storico partite</h1>
      <ul className="space-y-2">
        {(partite ?? []).map((match) => (
          <li key={match.id}>
            <button
              type="button"
              onClick={() => handleApri(match.id, match.stato)}
              className="w-full rounded-lg bg-slate-800 px-4 py-3 text-left text-lg hover:bg-slate-700"
            >
              {match.data} — {nomeSquadra(match.squadraAId)} vs {nomeSquadra(match.squadraBId)} ({match.stato})
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 2: Aggiungi la rotta in `src/app/router.tsx`**

Aggiungi l'import `import { HistoryListPage } from '@/features/history/HistoryListPage';` e la rotta `{ path: '/storico', element: <HistoryListPage /> }`.

- [ ] **Step 3: Scrivi il test `src/features/history/HistoryListPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { HistoryListPage } from './HistoryListPage';

describe('HistoryListPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.matches.clear();
    await db.sets.clear();
  });

  it('naviga al report per una partita conclusa', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-10', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    await db.matches.update(match.id, { stato: 'conclusa' });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
          <Route path="/storico/:matchId" element={<div>Report partita</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText(/Volley Rossi vs Volley Blu/));
    expect(await screen.findByText('Report partita')).toBeInTheDocument();
  });

  it('riprende una partita in corso allultimo set aperto', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/storico']}>
        <Routes>
          <Route path="/storico" element={<HistoryListPage />} />
          <Route path="/partite/:matchId/scouting/:setId" element={<div>Scouting ripreso</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(await screen.findByText(/Volley Rossi vs Volley Blu/));
    expect(await screen.findByText('Scouting ripreso')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- HistoryListPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/history/HistoryListPage.tsx src/features/history/HistoryListPage.test.tsx src/app/router.tsx
git commit -m "feat: add match history list with resume and report navigation"
```

### Task 26: Report partita (sola lettura)

**Files:**
- Create: `src/features/history/MatchReportPage.tsx`
- Modify: `src/app/router.tsx` (aggiunge la rotta `/storico/:matchId`)
- Test: `src/features/history/MatchReportPage.test.tsx`

**Interfaces:**
- Consumes: `caricaDatiSet` da `@/db/scouting` (Task 6), `deriveSetState` da `@/domain/reducer` (Task 8), `calcolaStatistiche` da `@/domain/stats` (Task 9).
- Produces: rotta `/storico/:matchId` (destinazione di `HistoryListPage`, Task 25).

- [ ] **Step 1: Crea `src/features/history/MatchReportPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { deriveSetState } from '@/domain/reducer';
import { calcolaStatistiche } from '@/domain/stats';
import type { Azione, Fondamentale, Match, Player, SetPallavolo } from '@/domain/types';

const FONDAMENTALI: Fondamentale[] = ['battuta', 'ricezione', 'attacco', 'muro'];

interface RiepilogoSet {
  set: SetPallavolo;
  punteggioA: number;
  punteggioB: number;
}

export function MatchReportPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [match, setMatch] = useState<Match | null>(null);
  const [giocatori, setGiocatori] = useState<Player[]>([]);
  const [riepilogoSet, setRiepilogoSet] = useState<RiepilogoSet[]>([]);
  const [azioniTotali, setAzioniTotali] = useState<Azione[]>([]);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      const m = await db.matches.get(matchId);
      if (!m) return;
      setMatch(m);
      const [giocatoriA, giocatoriB] = await Promise.all([
        db.players.where('teamId').equals(m.squadraAId).toArray(),
        db.players.where('teamId').equals(m.squadraBId).toArray(),
      ]);
      setGiocatori([...giocatoriA, ...giocatoriB]);

      const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
      const riepiloghi: RiepilogoSet[] = [];
      const tutteLeAzioni: Azione[] = [];
      for (const set of sets) {
        const dati = await caricaDatiSet(set.id);
        const azioniPerRally = new Map<string, Azione[]>();
        for (const azione of dati.azioni) {
          const lista = azioniPerRally.get(azione.rallyId) ?? [];
          lista.push(azione);
          azioniPerRally.set(azione.rallyId, lista);
        }
        const stato = deriveSetState(set, dati.rallies, azioniPerRally, dati.sostituzioni);
        riepiloghi.push({ set, punteggioA: stato.punteggioA, punteggioB: stato.punteggioB });
        tutteLeAzioni.push(...dati.azioni);
      }
      setRiepilogoSet(riepiloghi);
      setAzioniTotali(tutteLeAzioni);
    })();
  }, [matchId]);

  if (!match) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <h1 className="mb-4 text-2xl font-bold">Report partita — {match.data}</h1>
      <section className="mb-6">
        <h2 className="mb-2 text-xl font-semibold">Set</h2>
        <ul className="space-y-1">
          {riepilogoSet.map(({ set, punteggioA, punteggioB }) => (
            <li key={set.id} data-testid={`riepilogo-set-${set.numero}`}>
              Set {set.numero}: {punteggioA} - {punteggioB}
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="mb-2 text-xl font-semibold">Box score</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th className="pb-2">Giocatore</th>
              {FONDAMENTALI.map((f) => (
                <th key={f} className="pb-2 capitalize">{f}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {giocatori.map((g) => (
              <tr key={g.id} className="border-t border-slate-700">
                <td className="py-2">#{g.numero} {g.nome}</td>
                {FONDAMENTALI.map((f) => {
                  const stats = calcolaStatistiche(azioniTotali, f, g.id);
                  return (
                    <td key={f} className="py-2" data-testid={`box-${g.id}-${f}`}>
                      {stats.tentativi > 0 ? `${stats.efficienzaPercento.toFixed(0)}% (${stats.tentativi})` : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Aggiungi la rotta in `src/app/router.tsx`**

Aggiungi l'import `import { MatchReportPage } from '@/features/history/MatchReportPage';` e la rotta `{ path: '/storico/:matchId', element: <MatchReportPage /> }`.

- [ ] **Step 3: Scrivi il test `src/features/history/MatchReportPage.test.tsx`**

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { MatchReportPage } from './MatchReportPage';

describe('MatchReportPage', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
  });

  it('mostra il punteggio finale del set e il box score derivati dalle azioni salvate', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#', zona: 1, direzione: 5,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');
    await db.matches.update(match.id, { stato: 'conclusa' });

    render(
      <MemoryRouter initialEntries={[`/storico/${match.id}`]}>
        <Routes>
          <Route path="/storico/:matchId" element={<MatchReportPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByTestId('riepilogo-set-1')).toHaveTextContent('Set 1: 1 - 0');
    expect(await screen.findByTestId(`box-${giocatoreA1.id}-battuta`)).toHaveTextContent('100% (1)');
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- MatchReportPage`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/history/MatchReportPage.tsx src/features/history/MatchReportPage.test.tsx src/app/router.tsx
git commit -m "feat: add read-only match report with per-set score and box score"
```

### Task 27: Export CSV

**Files:**
- Create: `src/features/export/exportCsv.ts`
- Test: `src/features/export/exportCsv.test.ts`
- Modify: `src/features/history/MatchReportPage.tsx` (pulsanti di export)

**Interfaces:**
- Consumes: `db` da `@/db/schema`, `caricaDatiSet` da `@/db/scouting` (Task 6), `calcolaStatistiche` da `@/domain/stats` (Task 9).
- Produces: `generaCsvAzioni(matchId): Promise<string>`, `generaCsvBoxScore(matchId): Promise<string>`, `scaricaCsv(nomeFile, contenuto): void` da `@/features/export/exportCsv`.

- [ ] **Step 1: Crea `src/features/export/exportCsv.ts`**

```ts
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { calcolaStatistiche } from '@/domain/stats';
import type { Azione, Fondamentale } from '@/domain/types';

const FONDAMENTALI: Fondamentale[] = ['battuta', 'ricezione', 'attacco', 'muro'];

function escapeCsv(valore: string | number | null): string {
  const testo = String(valore ?? '');
  if (testo.includes(',') || testo.includes('"') || testo.includes('\n')) {
    return `"${testo.replace(/"/g, '""')}"`;
  }
  return testo;
}

export async function generaCsvAzioni(matchId: string): Promise<string> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');
  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];
  const nomeGiocatore = (id: string | null) => {
    if (!id) return '';
    const g = giocatori.find((p) => p.id === id);
    return g ? `#${g.numero} ${g.nome}` : id;
  };

  const intestazione = [
    'data', 'set', 'rally', 'squadra', 'giocatore', 'fondamentale', 'tipoBattuta',
    'valutazione', 'zona', 'direzione', 'timestamp',
  ];
  const righe = [intestazione.join(',')];

  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    const numeroRallyPerRallyId = new Map(dati.rallies.map((r) => [r.id, r.numero]));
    for (const azione of dati.azioni) {
      righe.push(
        [
          escapeCsv(match.data),
          escapeCsv(set.numero),
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
  }
  return righe.join('\n');
}

export async function generaCsvBoxScore(matchId: string): Promise<string> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');
  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];

  const tutteLeAzioni: Azione[] = [];
  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    tutteLeAzioni.push(...dati.azioni);
  }

  const intestazione = ['giocatore', ...FONDAMENTALI.flatMap((f) => [`${f}_tentativi`, `${f}_efficienza`])];
  const righe = [intestazione.join(',')];
  for (const giocatore of giocatori) {
    const cella = [escapeCsv(`#${giocatore.numero} ${giocatore.nome}`)];
    for (const fondamentale of FONDAMENTALI) {
      const stats = calcolaStatistiche(tutteLeAzioni, fondamentale, giocatore.id);
      cella.push(escapeCsv(stats.tentativi), escapeCsv(stats.efficienzaPercento.toFixed(1)));
    }
    righe.push(cella.join(','));
  }
  return righe.join('\n');
}

export function scaricaCsv(nomeFile: string, contenuto: string): void {
  const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Scrivi il test `src/features/export/exportCsv.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from './exportCsv';

describe('exportCsv', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
  });

  async function creaScenarioBase() {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'battuta', tipoBattuta: 'flottante', valutazione: '#', zona: 1, direzione: 5,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    return { match, giocatoreA1 };
  }

  it('genera il csv delle azioni con una riga per azione', async () => {
    const { match, giocatoreA1 } = await creaScenarioBase();
    const csv = await generaCsvAzioni(match.id);
    const righe = csv.split('\n');
    expect(righe[0]).toBe('data,set,rally,squadra,giocatore,fondamentale,tipoBattuta,valutazione,zona,direzione,timestamp');
    expect(righe[1]).toContain(`#1 ${giocatoreA1.nome}`);
    expect(righe[1]).toContain('battuta');
    expect(righe).toHaveLength(2);
  });

  it('genera il csv del box score con tentativi ed efficienza per fondamentale', async () => {
    const { match, giocatoreA1 } = await creaScenarioBase();
    const csv = await generaCsvBoxScore(match.id);
    const righe = csv.split('\n');
    const rigaGiocatore = righe.find((r) => r.startsWith(`#1 ${giocatoreA1.nome}`));
    expect(rigaGiocatore).toContain('1,100.0');
  });

  it('scaricaCsv crea e scarica un blob con il nome file indicato', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    scaricaCsv('partita.csv', 'a,b,c');

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 3: Esegui i test**

Run: `npm test -- exportCsv`
Expected: PASS.

- [ ] **Step 4: Modifica `src/features/history/MatchReportPage.tsx` per aggiungere i pulsanti di export**

Aggiungi l'import:

```tsx
import { generaCsvAzioni, generaCsvBoxScore, scaricaCsv } from '@/features/export/exportCsv';
```

Aggiungi, subito dopo l'`<h1>` del report:

```tsx
<div className="mb-4 flex gap-3">
  <button
    type="button"
    onClick={async () => scaricaCsv(`partita-${match.data}-azioni.csv`, await generaCsvAzioni(match.id))}
    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
  >
    Esporta CSV azioni
  </button>
  <button
    type="button"
    onClick={async () => scaricaCsv(`partita-${match.data}-box-score.csv`, await generaCsvBoxScore(match.id))}
    className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
  >
    Esporta CSV box score
  </button>
</div>
```

- [ ] **Step 5: Esegui i test**

Run: `npm test -- MatchReportPage exportCsv`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/export/exportCsv.ts src/features/export/exportCsv.test.ts src/features/history/MatchReportPage.tsx
git commit -m "feat: add CSV export for match actions and box score"
```

### Task 28: Export PDF

**Files:**
- Modify: `package.json` (aggiunge la dipendenza `jspdf`)
- Create: `src/features/export/exportPdf.ts`
- Test: `src/features/export/exportPdf.test.ts`
- Modify: `src/features/history/MatchReportPage.tsx` (pulsante di export PDF)

**Interfaces:**
- Consumes: `db` da `@/db/schema`, `caricaDatiSet` da `@/db/scouting`, `deriveSetState` da `@/domain/reducer`, `calcolaStatistiche` da `@/domain/stats`.
- Produces: `generaPdfReport(matchId): Promise<Blob>`, `scaricaPdf(nomeFile, blob): void` da `@/features/export/exportPdf`.

- [ ] **Step 1: Installa `jspdf`**

Run: `npm install jspdf`
Expected: `jspdf` aggiunto a `dependencies` in `package.json`.

- [ ] **Step 2: Crea `src/features/export/exportPdf.ts`**

```ts
import { jsPDF } from 'jspdf';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { deriveSetState } from '@/domain/reducer';
import { calcolaStatistiche } from '@/domain/stats';
import type { Azione, SetPallavolo } from '@/domain/types';

export async function generaPdfReport(matchId: string): Promise<Blob> {
  const match = await db.matches.get(matchId);
  if (!match) throw new Error('Partita non trovata');
  const sets = await db.sets.where('matchId').equals(matchId).sortBy('numero');
  const [giocatoriA, giocatoriB] = await Promise.all([
    db.players.where('teamId').equals(match.squadraAId).toArray(),
    db.players.where('teamId').equals(match.squadraBId).toArray(),
  ]);
  const giocatori = [...giocatoriA, ...giocatoriB];

  const riepiloghi: { set: SetPallavolo; punteggioA: number; punteggioB: number }[] = [];
  const tutteLeAzioni: Azione[] = [];
  for (const set of sets) {
    const dati = await caricaDatiSet(set.id);
    const azioniPerRally = new Map<string, Azione[]>();
    for (const azione of dati.azioni) {
      const lista = azioniPerRally.get(azione.rallyId) ?? [];
      lista.push(azione);
      azioniPerRally.set(azione.rallyId, lista);
    }
    const stato = deriveSetState(set, dati.rallies, azioniPerRally, dati.sostituzioni);
    riepiloghi.push({ set, punteggioA: stato.punteggioA, punteggioB: stato.punteggioB });
    tutteLeAzioni.push(...dati.azioni);
  }

  const doc = new jsPDF();
  let y = 20;
  doc.setFontSize(16);
  doc.text(`Report partita — ${match.data}`, 14, y);
  y += 10;

  doc.setFontSize(12);
  for (const { set, punteggioA, punteggioB } of riepiloghi) {
    doc.text(`Set ${set.numero}: ${punteggioA} - ${punteggioB}`, 14, y);
    y += 7;
  }

  y += 5;
  doc.setFontSize(14);
  doc.text('Efficienza attacco per giocatore', 14, y);
  y += 8;

  doc.setFontSize(10);
  const larghezzaBarraMax = 100;
  for (const giocatore of giocatori) {
    const stats = calcolaStatistiche(tutteLeAzioni, 'attacco', giocatore.id);
    if (stats.tentativi === 0) continue;
    doc.text(`#${giocatore.numero} ${giocatore.nome} (${stats.efficienzaPercento.toFixed(0)}%)`, 14, y);
    doc.rect(90, y - 4, larghezzaBarraMax, 4);
    const larghezzaBarra = Math.max(0, (Math.max(0, stats.efficienzaPercento) / 100) * larghezzaBarraMax);
    if (larghezzaBarra > 0) {
      doc.setFillColor(37, 99, 235);
      doc.rect(90, y - 4, larghezzaBarra, 4, 'F');
    }
    y += 8;
  }

  return doc.output('blob');
}

export function scaricaPdf(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  link.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Scrivi il test `src/features/export/exportPdf.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db/schema';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import { creaPartita, creaSet, aggiornaStatoSet } from '@/db/matches';
import { salvaRally, salvaAzione } from '@/db/scouting';
import { generaPdfReport, scaricaPdf } from './exportPdf';

describe('exportPdf', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
  });

  it('genera un blob PDF non vuoto con il punteggio e il box score della partita', async () => {
    const squadraA = await creaSquadra('Volley Rossi');
    const squadraB = await creaSquadra('Volley Blu');
    const giocatoreA1 = await aggiungiGiocatore({ teamId: squadraA.id, numero: 1, nome: 'A1', ruolo: 'schiacciatore' });
    const match = await creaPartita({
      data: '2026-09-16', squadraAId: squadraA.id, squadraBId: squadraB.id,
      squadraRiferimentoId: squadraA.id, formatoSet: 3, puntiSet: 25, puntiSetDecisivo: 15,
    });
    const set = await creaSet({
      matchId: match.id, numero: 1,
      formazioneInizialeA: [giocatoreA1.id, 'a2', 'a3', 'a4', 'a5', 'a6'],
      formazioneInizialeB: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6'],
      primaSquadraAlServizio: 'A',
    });
    await salvaRally({ id: 'r1', setId: set.id, numero: 1, squadraAlServizio: 'A', esito: null, chiusuraManuale: false });
    await salvaAzione({
      id: 'az1', rallyId: 'r1', setId: set.id, ordine: 1, squadra: 'A', giocatoreId: giocatoreA1.id,
      fondamentale: 'attacco', tipoBattuta: null, valutazione: '#', zona: 4, direzione: 5,
      timestamp: '2026-09-16T10:00:00.000Z',
    });
    await aggiornaStatoSet(set.id, 'concluso', 'A');

    const blob = await generaPdfReport(match.id);

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('scaricaPdf crea e scarica un blob con il nome file indicato', () => {
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    scaricaPdf('partita.pdf', new Blob(['%PDF-1.4'], { type: 'application/pdf' }));

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 4: Esegui i test**

Run: `npm test -- exportPdf`
Expected: PASS.

- [ ] **Step 5: Modifica `src/features/history/MatchReportPage.tsx` per aggiungere il pulsante di export PDF**

Aggiungi l'import:

```tsx
import { generaPdfReport, scaricaPdf } from '@/features/export/exportPdf';
```

Aggiungi, dentro il `<div className="mb-4 flex gap-3">` creato nel Task 27, un terzo pulsante:

```tsx
<button
  type="button"
  onClick={async () => scaricaPdf(`partita-${match.data}.pdf`, await generaPdfReport(match.id))}
  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold"
>
  Esporta PDF
</button>
```

- [ ] **Step 6: Esegui l'intera suite di test**

Run: `npm test`
Expected: PASS — tutti i test del progetto superati.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/features/export/exportPdf.ts src/features/export/exportPdf.test.ts src/features/history/MatchReportPage.tsx
git commit -m "feat: add PDF export with per-set score and attack efficiency chart"
```
