# Allineamento a Click&Scout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare nel programma la striscia codici DataVolley con Annulla, Replay, direzioni di battuta dal vivo, attacchi per rotazione, formazione a griglia, tabellino unico nell'app, archivio con scheda partita e analisi su più partite, come in Click&Scout.

**Architecture:** Due moduli di dominio puri fanno da base: `cronologiaSet` (stato prima/dopo ogni rally: servizio, rotazioni, punteggio) e `codiciDataVolley` (codici ricavati dai dati, mai salvati). Sopra ci sono le statistiche nuove del tabellino (punti, BP, V‑P, punti vinti per fonte, posizioni di partenza, durata e parziali) e le viste React: striscia, colonna rotazioni, griglia formazione, pagina tabellino, scheda partita, analisi incontri.

**Tech Stack:** React 18, TypeScript, Zustand, Tailwind, Supabase, Vitest + Testing Library, jsPDF/ExcelJS (export esistenti).

**Spec:** `docs/superpowers/specs/2026-10-16-allineamento-click-and-scout-design.md`

## Global Constraints

- Nessuna nuova dipendenza npm.
- Testi dell'interfaccia in italiano; nomi di codice in italiano come nel resto del repo.
- Nessun tocco in più nello scambio tipico rispetto a oggi.
- I codici DataVolley non si salvano: si ricalcolano dai dati a ogni render.
- Fuori ambito: tipo d'attacco, numero di giocatori a muro, timeout/sostituzioni, dati partita aggiuntivi, allenatore/assistente, altre analisi di Click&Scout.
- Colori esito già in uso: nero = punto, verde = palla rigiocata, rosso = errore/murato.
- Comando test: `npm test` (vitest run). Comando build/tipi: `npm run build`.

## Review Focus

1. Rally chiuso a mano senza azioni (Punto / Er.Avv. a rally vuoto): la striscia mostra solo il codice punto e il tabellino lo conta in Er.Av. → test in Task 2 e Task 7.
2. Annulla subito dopo una correzione di valutazione: l'evidenziato deve essere l'azione corretta e Annulla deve togliere la correzione, non l'azione → test in Task 3.
3. Azione con `giocatoreId` null (muro "Tralascia", dati vecchi) → codice con `$$`, nessun crash nel tabellino → test in Task 2.
4. Set con `paleggiatoreId` null per una squadra: niente colonna P1–P6 e niente ruoli; nessun crash → test in Task 6.
5. Analisi su più partite in cui la squadra è A in una partita e B in un'altra: i numeri si sommano sulla squadra giusta → test in Task 11.

---

### Task 1: Cronologia del set

**Files:**
- Create: `src/domain/cronologiaSet.ts`
- Test: `src/domain/cronologiaSet.test.ts`

**Interfaces:**
- Consumes: `deriveSetState` logic, `ruotaPosizioni`, `applicaSostituzione`, `determinaEsitoAutomatico` (`src/domain/reducer.ts`, `rotation.ts`).
- Produces:
```ts
export interface InfoRally {
  rallyId: string;
  numero: number;
  squadraAlServizio: Squadra;      // prima del rally
  rotazioneA: string[];            // prima del rally (index 0 = zona 1)
  rotazioneB: string[];
  vincitore: Squadra | null;       // null = rally aperto
  punteggioA: number;              // dopo il rally (solo rally, senza correzioni)
  punteggioB: number;
}
export function cronologiaSet(
  set: SetPallavolo, rallies: Rally[], azioni: Azione[], sostituzioni: Sostituzione[],
): InfoRally[];
export function zonaPalleggiatore(rotazione: string[], palleggiatoreId: string | null): 1|2|3|4|5|6|null;
```

- [ ] **Step 1: Write the failing tests**

```ts
it('segue servizio, rotazione e punteggio rally per rally', () => {
  // set con primaSquadraAlServizio 'A', formazione A [a1..a6], B [b1..b6]
  // rally 1: battuta A '=' (punto B); rally 2: attacco B '#' (punto B); rally 3 aperto
  const c = cronologiaSet(set, rallies, azioni, []);
  expect(c.map((r) => r.squadraAlServizio)).toEqual(['A', 'B', 'B']);
  expect(c[1].rotazioneB).toEqual(['b2','b3','b4','b5','b6','b1']); // B ha ruotato al cambio palla
  expect(c.map((r) => [r.punteggioA, r.punteggioB])).toEqual([[0,1],[0,2],[0,2]]);
  expect(c[2].vincitore).toBeNull();
});
it('ultimo stato coerente con deriveSetState', () => { /* stessi dati: servizio e rotazioni dopo l'ultimo rally chiuso == deriveSetState */ });
it('rally manuale senza azioni usa rally.esito', () => { /* chiusuraManuale true, esito punto_A → vincitore 'A' */ });
it('zonaPalleggiatore', () => {
  expect(zonaPalleggiatore(['p','x','x','x','x','x'], 'p')).toBe(1);
  expect(zonaPalleggiatore(['x','x','x','p','x','x'], 'p')).toBe(4);
  expect(zonaPalleggiatore(['x','x','x','x','x','x'], null)).toBeNull();
});
```

- [ ] **Step 2: Run** `npx vitest run src/domain/cronologiaSet.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** with the same loop as `deriveSetState` (same `rallyUnici` dedup: export it from `reducer.ts` instead of copying), recording the state before each rally. Substitutions apply `dopoRallyNumero === numero - 1` before the rally, as in the reducer.
- [ ] **Step 4: Run** the test file — Expected: PASS. Run `npx vitest run src/domain` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: cronologia del set rally per rally`

---

### Task 2: Codici DataVolley

**Files:**
- Create: `src/domain/codiciDataVolley.ts`
- Test: `src/domain/codiciDataVolley.test.ts`

**Interfaces:**
- Consumes: `InfoRally`, `cronologiaSet` (Task 1).
- Produces:
```ts
export interface CodiceStriscia {
  chiave: string;              // id stabile per React
  testo: string;               // es. 'a15SQ-'
  squadra: Squadra | null;     // null per fine set
  azioneIds: string[];         // [] per punto/fine set
  gesto: string;               // azioni dello stesso gesto (stesso timestamp) condividono il valore
}
export function codiceAzione(azione: Azione, numeroGiocatore: number | null): string;
export function codiciSet(params: {
  set: SetPallavolo; rallies: Rally[]; azioni: Azione[]; sostituzioni: Sostituzione[];
  numeroDi: (giocatoreId: string) => number | null;
}): CodiceStriscia[];
```

Formato (dalla spec): prefisso `*` per A, `a` per B; numero a due cifre o `$$`; `S R A B`; tipo da `tipoBattuta` per S e R (`salto_spin`→`Q`, `salto_flottante`→`M`, `flottante`→`H`; la ricezione eredita il tipo della battuta del suo rally; se assente `H`), `H` fisso per A e B; poi la valutazione. Punto: `*pAA:BB` / `apAA:BB` con punteggio dopo il rally a due cifre, A prima. Fine set (`set.stato === 'concluso'`): `**NSet`. Ordine: azioni del rally per `ordine`, poi il codice punto del rally se chiuso.

- [ ] **Step 1: Write the failing tests**

```ts
it('codice battuta, ricezione, attacco, muro', () => {
  expect(codiceAzione(battuta({ squadra: 'B', tipoBattuta: 'salto_spin', valutazione: '-' }), 15)).toBe('a15SQ-');
  expect(codiceAzione(attacco({ squadra: 'A', valutazione: '#' }), 46)).toBe('*46AH#');
  expect(codiceAzione(muro({ squadra: 'A', valutazione: '#' }), null)).toBe('*$$BH#');
  expect(codiceAzione(attacco({ squadra: 'A', valutazione: '+' }), 7)).toBe('*07AH+');
});
it('la ricezione eredita il tipo della battuta', () => { /* codiciSet: battuta salto_spin poi ricezione A '+' n.98 → '*98RQ+' */ });
it('codice punto con punteggio dopo il rally', () => { /* rally vinto da A 1-0 → '*p01:00'; poi B 1-1 → 'ap01:01' */ });
it('rally manuale senza azioni produce solo il punto', () => { /* un solo codice 'ap00:01' con azioneIds [] */ });
it('battuta+ricezione dello stesso gesto hanno lo stesso gesto', () => { /* stesso timestamp → stesso campo gesto */ });
it('set concluso aggiunge **NSet in fondo', () => { /* numero 4 → '**4Set' */ });
```

- [ ] **Step 2: Run** `npx vitest run src/domain/codiciDataVolley.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** using `cronologiaSet` for the per-rally score.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: codici DataVolley ricavati dalle azioni`

---

### Task 3: Striscia codici nello scout + Annulla

**Files:**
- Create: `src/features/live-scouting/StrisciaCodici.tsx`, `src/features/live-scouting/StrisciaCodici.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx` (pulsante "Annulla ultima azione" ~riga 419; `StrisciaUltimaAzione` ~riga 766)
- Test: `src/features/live-scouting/LiveScoutingScreen.test.tsx`

**Interfaces:**
- Consumes: `codiciSet`, `CodiceStriscia` (Task 2); store `annullaUltimaAzione`, `storiaCorrezioni`.
- Produces: `StrisciaCodici({ codici, evidenziati, onAnnulla, disabilitato }: { codici: CodiceStriscia[]; evidenziati: string[] /* chiavi */; onAnnulla: () => void; disabilitato: boolean })`.

Comportamento: barra fissa in basso; codici in ordine, colorati per squadra con i colori di `CampoDaGioco` (A `#2563eb`, B `#f97316`), punto/fine set in nero; i codici evidenziati sono uniti al tasto **Annulla** (rosso) a destra; mostra gli ultimi che entrano nella larghezza, con « » per scorrere indietro/avanti di una pagina. Si torna sempre in fondo quando arriva un codice nuovo. Il vecchio pulsante "Annulla ultima azione" in testata viene tolto; il comportamento di `onAnnulla` è lo stesso di oggi (prima `flusso.current?.indietro()`, poi `annullaUltimaAzione()`).

Evidenziati = codici del bersaglio di `trovaUltimoAnnullabile`: se `tipo === 'azioni'` i codici con quegli `azioneIds` (se c'è una correzione in `storiaCorrezioni` su una di quelle azioni, solo il codice dell'azione corretta); se `rallyManuale` il codice punto di quel rally; sostituzione/timeout/correzione punteggio: nessun codice evidenziato. I bottoni di correzione di `StrisciaUltimaAzione` restano, sopra la striscia.

- [ ] **Step 1: Write the failing tests**

```ts
// StrisciaCodici.test.tsx
it('mostra i codici e unisce gli evidenziati al tasto Annulla', () => {
  render(<StrisciaCodici codici={[c('a15SQ-'), c('*98RQ+')]} evidenziati={['k2']} onAnnulla={fn} disabilitato={false} />);
  expect(within(screen.getByTestId('codici-evidenziati')).getByText('*98RQ+')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Annulla' }));
  expect(fn).toHaveBeenCalledOnce();
});
// LiveScoutingScreen.test.tsx
it('dopo battuta+ricezione la striscia mostra i due codici e Annulla li toglie entrambi', async () => { /* … */ });
it('dopo una correzione di valutazione Annulla toglie la correzione e il codice torna come prima', async () => {
  // registra attacco '+', correggi in '#': evidenziato '*07AH#'; Annulla → '*07AH+' ancora presente
});
```

- [ ] **Step 2: Run** `npx vitest run src/features/live-scouting` — Expected: FAIL.
- [ ] **Step 3: Implement** `StrisciaCodici` and wire it in `LiveScoutingScreen` (codici from the store's current set data; `numeroDi` from `giocatori`). Update existing tests that clicked "Annulla ultima azione" to the new button name.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: striscia codici DataVolley con Annulla`

---

### Task 4: Replay (palla da rigiocare)

**Files:**
- Modify: `src/store/liveMatchStore.ts`, `src/features/live-scouting/LiveScoutingScreen.tsx`
- Test: `src/store/liveMatchStore.test.ts`, `src/features/live-scouting/LiveScoutingScreen.test.tsx`

**Interfaces:**
- Produces: store action `rigiocaRally: () => Promise<void>`.

Elimina con `eliminaAzioni` tutte le azioni del rally aperto, poi il rally con `eliminaRallySeVuoto`; toglie dallo stato le stesse cose e le voci di `storiaCorrezioni` di quelle azioni; servizio e rotazione restano invariati; nessun effetto se il rally aperto non esiste o non ha azioni. Gira dentro `esclusiva`. Non è annullabile. In UI: tasto "Replay" nella barra dello scout, disattivato senza azioni nel rally aperto; chiede `window.confirm('L\'intero scambio verrà eliminato, continuare?')`.

- [ ] **Step 1: Write the failing tests**

```ts
it('rigiocaRally elimina le azioni del rally aperto senza cambiare punteggio e servizio', async () => {
  // set con 1 rally chiuso (A 1-0) + rally aperto con battuta e ricezione
  await store.rigiocaRally();
  expect(store.azioni.filter((a) => a.rallyId === apertoId)).toHaveLength(0);
  expect(store.statoDerivato()).toMatchObject({ punteggioA: 1, punteggioB: 0, squadraAlServizio: 'A' });
});
it('Replay chiede conferma e con "annulla" non tocca nulla', async () => { /* confirm → false */ });
```

- [ ] **Step 2: Run** — Expected: FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: palla da rigiocare`

---

### Task 5: Direzioni di battuta del battitore dal vivo

**Files:**
- Modify: `src/components/CampoDaGioco.tsx`, `src/features/live-scouting/BattutaFlow.tsx`, `src/features/live-scouting/LiveScoutingScreen.tsx`
- Test: `src/components/CampoDaGioco.test.tsx`, `src/features/live-scouting/BattutaFlow.test.tsx`

**Interfaces:**
- Produces: prop `traiettorieExtra?: Traiettoria[]` su `CampoDaGioco` (disegnate come `ultimaTraiettoria`, con `data-testid="traiettoria-extra"`); prop `storicoBattute?: Traiettoria[]` su `BattutaFlow`, passata a `traiettorieExtra` solo finché non è stato toccato il punto di partenza.
- Helper in `src/domain/analysis.ts`: `export function traiettoriaDaFreccia(f: FrecciaAttacco): Traiettoria` (`punto`→`punto_esecutore`, `errore`→`punto_avversario`, `difeso`→`continua`).

In `LiveScoutingScreen`: battitore = `rotazione[0]` della squadra al servizio; `storicoBattute = frecceBattuta(azioniPartita, squadraAlServizio, battitoreId).map(traiettoriaDaFreccia)` (`azioniPartita` contiene già tutti i set). Nessun interruttore.

- [ ] **Step 1: Write the failing tests**

```ts
it('CampoDaGioco disegna le traiettorie extra', () => { /* 2 extra → 2 elementi traiettoria-extra */ });
it('BattutaFlow mostra lo storico finché non si tocca la partenza', async () => {
  // render con storicoBattute di 3 → 3 traiettoria-extra; tap sul campo (origine) → 0
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: direzioni di battuta del battitore dal vivo`

---

### Task 5b: Murante solo in prima linea, saltabile

**Files:**
- Modify: `src/features/live-scouting/AttaccoMuroFlow.tsx` (passo `muro-giocatore`, modalità ~riga 177), `src/features/live-scouting/LiveScoutingScreen.tsx` (registrazione del muro con `giocatoreId` null)
- Test: `src/features/live-scouting/AttaccoMuroFlow.test.tsx`

**Interfaces:**
- Consumes: modalità esistente `seleziona-giocatore-prima-linea` di `CampoDaGioco`.
- Produces: `DatiTocco.giocatoreId: string | null` (null = "Tralascia").

Nel passo `muro-giocatore` la modalità diventa `seleziona-giocatore-prima-linea` sulla squadra che mura; compare un tasto **"Tralascia"** che prosegue con `giocatoreId` null (codice `$$`).

- [ ] **Step 1: Write the failing tests**

```ts
it('al muro sono toccabili solo i giocatori in prima linea della squadra che mura', async () => {
  // dopo tap in fascia muro: giocatori zone 2,3,4 avversari data-attivo=true, zone 1,5,6 false
});
it('Tralascia registra il muro senza giocatore', async () => { /* onCompleta riceve tocco.giocatoreId === null */ });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: murante in prima linea e saltabile`

---

### Task 6: Attacchi per rotazione (P1–P6)

**Files:**
- Create: `src/domain/rotazioni.ts`, `src/domain/rotazioni.test.ts`, `src/features/rotazioni/ColonnaRotazioni.tsx`, `src/features/rotazioni/VistaRotazione.tsx`, `src/features/rotazioni/VistaRotazione.test.tsx`
- Modify: `src/features/live-scouting/LiveScoutingScreen.tsx`

**Interfaces:**
- Consumes: `cronologiaSet`, `zonaPalleggiatore` (Task 1); `idAzioniContrattacco` (`stats.ts`); `traiettoriaDaFreccia`, `classificaEsitoAttacco` (`analysis.ts`); `traiettorieExtra` (Task 5).
- Produces:
```ts
export type FiltroRotazione = 'dopoRicezione' | 'dopoRicezionePositiva' | 'contrattacco';
export interface DatiSetRotazioni { set: SetPallavolo; rallies: Rally[]; azioni: Azione[]; sostituzioni: Sostituzione[] }
export interface AttacchiRotazione { attacchi: Azione[]; rotazioneUltima: string[] | null }
export function attacchiInRotazione(p: {
  dati: DatiSetRotazioni[]; squadra: Squadra; zona: 1|2|3|4|5|6; filtro: FiltroRotazione;
}): AttacchiRotazione;
```
Regole: la rotazione di un rally è `zonaPalleggiatore(rotazione<squadra> prima del rally, set.paleggiatoreId<squadra>)`; set con palleggiatore null non contribuiscono. `dopoRicezione` = attacchi della squadra non in `idAzioniContrattacco`; `dopoRicezionePositiva` = di questi, quelli il cui rally ha una ricezione della squadra con valutazione `#` o `+`; `contrattacco` = attacchi della squadra in `idAzioniContrattacco`. `rotazioneUltima` = rotazione della squadra nel rally dell'ultimo attacco trovato.

UI: `ColonnaRotazioni({ attuale: 1..6 | null, onApri(zona) })` a destra dello scout, ordine P1, P6, P5, P4, P3, P2, attuale evidenziata; non si mostra se `attuale` è null. `VistaRotazione({ squadra, nomeSquadra, giocatori, dati, zonaIniziale, onChiudi })`: titolo "‹squadra› – P‹n›", campo inattivo con le frecce degli attacchi filtrati (`traiettorieExtra`), giocatori nella `rotazioneUltima`, tre filtri (default "Att dopo Ric"), caselle P per cambiare zona, "Finito". Squadra nello scout: la squadra di riferimento della partita se c'è, altrimenti un selettore A/B nella vista.

- [ ] **Step 1: Write the failing tests**

```ts
it('attacchi dopo ricezione nella rotazione del palleggiatore in zona 1', () => { /* 2 rally in P1, 1 in P6 → solo quelli di P1 */ });
it('dopo ricezione positiva esclude le ricezioni - ! /', () => { /* … */ });
it('contrattacco usa idAzioniContrattacco', () => { /* … */ });
it('set senza palleggiatore non contribuisce e non va in errore', () => {
  expect(attacchiInRotazione({ dati: [setSenzaPalleggiatore], squadra: 'A', zona: 1, filtro: 'dopoRicezione' }).attacchi).toEqual([]);
});
it('VistaRotazione cambia filtro e zona', async () => { /* click 'Contrattacco' cambia il numero di traiettoria-extra; click 'P6' cambia titolo */ });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: attacchi per rotazione P1-P6`

---

### Task 7: Statistiche nuove del tabellino (dominio)

**Files:**
- Create: `src/domain/tabellinoExtra.ts`, `src/domain/tabellinoExtra.test.ts`
- Modify: `src/domain/reducer.ts` (export `vincePunto`)

**Interfaces:**
- Consumes: `cronologiaSet` (Task 1), `TABELLA_CHIUSURA`/`perdePunto`.
- Produces:
```ts
export function vincePunto(f: Azione['fondamentale'], v: Azione['valutazione']): boolean; // in reducer.ts
export interface StatPunti { tot: number; bp: number; vp: number }
export function statPunti(azioni: Azione[], rallies: Rally[], filtro: (a: Azione) => boolean): StatPunti;
export interface PuntiVinti { batt: number; att: number; mur: number; erAv: number }
export function puntiVintiPerFonte(azioni: Azione[], rallies: Rally[], squadra: Squadra): PuntiVinti;
export type CellaSet = { tipo: 'titolare'; posizione: 1|2|3|4|5|6; palleggiatore: boolean } | { tipo: 'entrato' } | null;
export function cellaSetGiocatore(p: { set: SetPallavolo; sostituzioni: Sostituzione[]; azioni: Azione[]; giocatore: Player }): CellaSet;
export function durataSet(azioni: Azione[]): string;           // 'h.mm', '0.00' se < 2 azioni
export function parzialiSet(cronologia: InfoRally[]): [string | null, string | null, string | null]; // 'A-B' al primo raggiungimento di 8, 16, 21 da una delle due
```
Regole: `tot` = azioni del filtro con `vincePunto`; `bp` = di queste, quelle in rally con `squadraAlServizio === azione.squadra`; `vp` = `tot` − azioni del filtro con `perdePunto`. Punti vinti: per ogni rally vinto dalla squadra, ultima azione del rally (per `ordine`) della squadra con `vincePunto` → per fondamentale (battuta→batt, attacco→att, muro→mur); altrimenti `erAv` (inclusi rally manuali senza azioni). `cellaSetGiocatore`: titolare se in `formazioneIniziale<squadra>` (posizione = indice+1, palleggiatore se è `paleggiatoreId`), `entrato` se è `giocatoreEntraId` di una sostituzione del set o ha azioni nel set, altrimenti null.

- [ ] **Step 1: Write the failing tests**

```ts
it('punti, break point e vinti-persi', () => {
  // giocatore A: attacco '#' con A al servizio, muro '#' con B al servizio, attacco '/' → tot 2, bp 1, vp 1
});
it('punti vinti per fonte con rally manuale senza azioni in erAv', () => { /* → { batt:0, att:1, mur:1, erAv:1 } */ });
it('cella set: titolare con posizione, palleggiatore, entrato', () => { /* … */ });
it('durata set in h.mm', () => { expect(durataSet([az('10:00'), az('11:07')])).toBe('1.07'); });
it('parziali a 8, 16, 21', () => { /* cronologia che passa 6-8, 10-16, 11-21 → ['6-8','10-16','11-21'] */ });
it('parziali non raggiunti restano null', () => { /* tie-break finito 15-10 passando da 8-5 → ['8-5', null, null] */ });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: statistiche punti, BP, V-P, punti vinti, posizioni di partenza`

---

### Task 8: Colonne nuove negli export PDF/Excel

**Files:**
- Modify: `src/features/export/tabellinoColonne.ts`, `src/features/export/exportPdf.ts`, `src/features/export/exportXlsx.ts`
- Test: test esistenti di export (aggiornare) + `src/features/export/tabellinoColonne.test.ts` (crea se manca)

**Interfaces:**
- Consumes: Task 7.
- Produces: `GRUPPI_TABELLINO` con un primo gruppo `{ titolo: 'Punti', colonne: ['Tot', 'BP', 'V-P'] }`; `sezioniTabellino` riceve anche `rallies: Rally[]` e ogni riga calcola `statPunti` sulle azioni della sezione. Firma: `sezioniTabellino(params: { giocatori; squadra; azioni; rallies; sets })`.

- [ ] **Step 1: Write the failing test** — `sezioniTabellino` restituisce per un giocatore i valori che iniziano con `[tot, bp, vp]`; intestazione PDF/Excel contiene il gruppo "Punti".
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** (passare `tutteLeRallies` da `caricaRiepilogoPartita`). **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: colonne punti negli export del tabellino`

---

### Task 9: Tabellino unico nell'app

**Files:**
- Create: `src/features/tabellino/TabellinoSquadra.tsx`, `src/features/tabellino/TabellinoPage.tsx`, `src/features/tabellino/TabellinoPage.test.tsx`
- Modify: `src/app/router.tsx` (route `/partite/:matchId/tabellino`), `src/features/live-scouting/LiveScoutingScreen.tsx` (tasto "Tabellino")

**Interfaces:**
- Consumes: `caricaRiepilogoPartita`, `sezioniTabellino`/`valoriRigaTabellino`, Task 7.
- Produces: `TabellinoSquadra({ nomeSquadra, righe, totale, puntiVinti, colonneSet })` riusato in Task 11, dove `righe: { numero; nome; libero: boolean; valori: (number|string)[]; celleSet?: CellaSet[] }[]`, `puntiVinti: { etichetta: string; valori: PuntiVinti }[]`, `colonneSet?: { primaBattuta: boolean[] }` (assente = niente colonne Set).

Pagina: fondo bianco, testo nero, bordi neri, intestazioni di gruppo su due righe come il referto Click&Scout; in alto a sinistra menu a tendina **Tutti / Set 1 … Set N** che filtra azioni e rallies; a destra PDF, Excel, Stampa (`window.print()`), Chiudi (torna indietro). Intestazione: squadre e set vinti, data, tabella set con Durata, Punteggi Parziali, Finali e totali. Per ogni squadra un `TabellinoSquadra` con colonne Set 1–5 (quadratino col numero, grassetto se palleggiatore; rettangolo vuoto se entrato; "L" accanto al nome dei liberi; cerchio sul numero del set in cui la squadra ha battuto per prima), le nostre colonne, totale squadra, righe "Punti Vinti" per set. Legenda in fondo.

- [ ] **Step 1: Write the failing tests**

```ts
it('mostra tabellino di entrambe le squadre con colonne Punti', async () => { /* mock caricaRiepilogoPartita */ });
it('il menu Set 1 filtra i numeri', async () => { /* selectOptions('Set 1') → totale battute cambia */ });
it('mostra durata e parziali del set', async () => { /* '1.07', '6-8' */ });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: tabellino unico consultabile nell'app`

---

### Task 10: Formazione a griglia

**Files:**
- Modify: `src/features/match-setup/LineupPicker.tsx`
- Create: `src/domain/ruoliDaSistema.ts`, `src/domain/ruoliDaSistema.test.ts`
- Test: `src/features/match-setup/LineupPicker.test.tsx`

**Interfaces:**
- Produces: `export function ruoloInSlot(indiceSlot: number, indicePalleggiatore: number, giro: Giro): 'P'|'S'|'C'|'O'` — offset `(indiceSlot - indicePalleggiatore + 6) % 6`: P-S-C (`schiacciatore-centrale`) → `[P,S,C,O,S,C]`; P-C-S (`centrale-schiacciatore`) → `[P,C,S,O,C,S]`. Deve concordare con `indiciCentrali` (`liberoAutoSwap.ts`).

UI (per ciascuna squadra, affiancate): rosa come bolle numerate (badge "P" per ruolo anagrafica palleggiatore), esclusi i liberi; campo 2×3 con rete in alto (riga alta zone 4-3-2, riga bassa 5-6-1); tocco su una bolla → va nella prima casella libera in ordine di zona 1..6 (casella successiva evidenziata in giallo) e sparisce dalla rosa; tocco su una casella piena → quel giocatore diventa palleggiatore (default: primo titolare con ruolo anagrafica palleggiatore); a 6 pieni compaiono **P-S-C** / **P-C-S** (default P-S-C) e le lettere di ruolo in ogni casella; tasti **Reset** e **Ruota** (riusa `ruotaFormazione` come il "gira" attuale). Liberi: invariati (scelta dei 2 liberi già esistente). Il salvataggio usa `avviaSet` come oggi (`formazioneIniziale`, `paleggiatoreId`, `giro`). Il selettore palleggiatore/giro a tendina attuale viene tolto.

- [ ] **Step 1: Write the failing tests**

```ts
it('ruoloInSlot P-S-C con palleggiatore in zona 1', () => {
  expect([0,1,2,3,4,5].map((i) => ruoloInSlot(i, 0, 'schiacciatore-centrale'))).toEqual(['P','S','C','O','S','C']);
});
it('ruoloInSlot concorda con indiciCentrali', () => { /* per ogni indice palleggiatore e giro */ });
it('la griglia riempie le zone 1..6 nell ordine di tocco e toglie i giocatori dalla rosa', async () => { /* … */ });
it('toccare una casella piena cambia palleggiatore; P-C-S cambia le lettere', async () => { /* … */ });
```
Aggiornare i test esistenti di `LineupPicker.test.tsx` (crea set nell'ordine di tap, doppio tap, gira formazione, libero non titolare) alla nuova UI senza cambiarne le asserzioni sul set salvato.

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` — PASS.
- [ ] **Step 5: Commit** `feat: formazione a griglia con ruoli dal sistema`

---

### Task 11: Archivio, scheda partita, analisi incontri

**Files:**
- Modify: `src/features/history/HistoryListPage.tsx`, `src/features/history/MatchReportPage.tsx` (diventa la scheda), `src/app/router.tsx` (route `/analisi`, link in home)
- Create: `src/db/risultatiPartite.ts`, `src/features/analisi-incontri/AnalisiIncontriPage.tsx`, `src/features/analisi-incontri/AnalisiIncontriPage.test.tsx`, `src/domain/sommaPartite.ts`, `src/domain/sommaPartite.test.ts`
- Test: `HistoryListPage.test.tsx`, `MatchReportPage.test.tsx`

**Interfaces:**
- Consumes: `TabellinoSquadra` (Task 9), `VistaRotazione`/`DatiSetRotazioni` (Task 6), `caricaRiepilogoPartita`.
- Produces:
```ts
export async function caricaSetVinti(matchIds: string[]): Promise<Map<string, { A: number; B: number }>>; // da sets.vincitore
export function normalizzaSuSquadra(azioni: Azione[], rallies: Rally[], lato: Squadra): { azioni: Azione[]; rallies: Rally[] }; // se lato==='B' scambia A<->B in squadra, squadraAlServizio, esito
```

Archivio: tabella con data, squadra A, set vinti "A - B", squadra B, note; in alto "Nuova partita"; riga → `/storico/:matchId`. Scheda: data, squadre, set vinti grandi, parziali `18-25 | 18-25 | …`; tasti **Analisi** (→ tabellino), **Elimina** (confirm, come oggi), **Esporta** (menu con i 4 export esistenti), **Rilevazione** (riapre lo scout dell'ultimo set con la stessa logica di `handleApri` dell'archivio di oggi); sotto restano cambi e timeout. Analisi incontri (`/analisi`): scegli squadra; elenco delle sue partite con checkbox (tutte selezionate); risultato: `TabellinoSquadra` della sola squadra, sommato con `normalizzaSuSquadra` su ogni partita, menu **Tutte / ‹partita›**, senza colonne Set e senza tabella durate; tasto "Rotazioni" che apre `VistaRotazione` sui dati sommati (squadra 'A' dopo la normalizzazione; set con `paleggiatoreId` presi dal lato giusto).

- [ ] **Step 1: Write the failing tests**

```ts
it('normalizzaSuSquadra porta la squadra scelta sul lato A', () => {
  const r = normalizzaSuSquadra([az({ squadra: 'B' })], [rally({ squadraAlServizio: 'B', esito: 'punto_B' })], 'B');
  expect(r.azioni[0].squadra).toBe('A'); expect(r.rallies[0]).toMatchObject({ squadraAlServizio: 'A', esito: 'punto_A' });
});
it('somma di due partite con la squadra su lati diversi', () => { /* battute totali = somma corretta */ });
it('archivio mostra i set vinti', async () => { /* '3 - 1' */ });
it('scheda: Rilevazione riapre lo scout', async () => { /* navigate verso /partite/:id/scouting/:setId */ });
it('analisi incontri: togliere una partita cambia i totali', async () => { /* … */ });
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test` and `npm run build` — PASS.
- [ ] **Step 5: Commit** `feat: archivio a tabella, scheda partita e analisi incontri`

---

### Task 12: Verifica finale nel browser

- [ ] Avvia il dev server con preview_start (`npm run dev`), crea una partita di prova da `/dev/seed`, gioca qualche scambio: controlla striscia + Annulla, Replay, direzioni di battuta, colonna P1–P6, tabellino con menu Set, archivio/scheda, analisi incontri. Screenshot come prova.
- [ ] `npm test` e `npm run build` verdi.
