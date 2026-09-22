# Design: valutazione automatica stile Click&Scout/DataVolley

Data: 2026-09-22 (revisione: rimossa l'estensione "fuori campo" del campo da gioco,
sostituita dalla striscia di correzione universale — vedi nota in fondo alla sezione 3)

## Obiettivo

Avvicinare il funzionamento della scouting live a quello di Click&Scout (touch,
"due tap") e alla notazione standard DataVolley su cui si appoggia, mantenendo il
flusso a tap sul campo già costruito nei design precedenti. Concretamente:

1. Portare la scala di valutazione da 5 a 6 simboli (`= / - ! + #`), come DataVolley,
   con il significato corretto per ciascun fondamentale.
2. Eliminare il tap esplicito di valutazione per battuta e ricezione, derivandola dalla
   geometria del tap di destinazione (dove è affidabile farlo).
3. Per ricezione, muro e attacco, applicare un default/valore derivato e permettere una
   correzione con un tap sulla striscia "ultima azione" — non un passo di flusso in più.
4. Colori della traiettoria coerenti con Click&Scout: nero punto, verde rally continua,
   rosso punto avversario (oggi: bianco/ambra generici).

Questo design **non** aggiunge i fondamentali mancanti rispetto a DataVolley (difesa,
alzata, free ball) — restano fuori scope, lavoro futuro separato. Riguarda solo
battuta, ricezione, attacco, muro, già presenti nell'app.

Estende/modifica il design precedente `2026-09-16-court-based-live-scouting-design.md`
(componente `CampoDaGioco`, flussi `BattutaFlow`/`RicezioneFlow`/`AttaccoMuroFlow`), che
resta valido per tutto il resto (rotazioni, timeout, sostituzioni, storico, report).

## 1. Modello dati

`src/domain/types.ts`: `Valutazione` guadagna `/`:

```ts
export type Valutazione = '#' | '+' | '!' | '-' | '/' | '=';
```

Nessun altro campo di `Azione` cambia forma. Non serve migrazione dati: i record
esistenti restano validi (usano solo il sottoinsieme di 5 valori già esistente).

### Significato di `/` per fondamentale (dalla tabella ufficiale DataVolley)

| Fondamentale | `/` significa |
|---|---|
| battuta | ricezione avversaria molto scarsa (quasi ace) |
| ricezione | pallone rimandato di netto nell'altro campo o free ball forzata |
| attacco | murato per punto (block del muro avversario vincente) |
| muro | invasione (tocco rete/antenna/piede) |

### `TABELLA_CHIUSURA` (`src/domain/reducer.ts`) — correzioni

Verificando la tabella ufficiale, due chiusure di rally mancano oggi e vanno aggiunte
insieme a `/` (non sono un effetto collaterale opzionale, sono bug di correttezza
scoperti in fase di analisi):

```ts
const TABELLA_CHIUSURA: Partial<Record<ChiaveChiusura, 'esecutore' | 'avversario'>> = {
  'battuta:#': 'esecutore',
  'battuta:=': 'avversario',
  'ricezione:=': 'avversario',
  'attacco:#': 'esecutore',
  'attacco:=': 'avversario',
  'attacco:/': 'avversario',   // NUOVO: murato per punto = punto muro avversario
  'muro:#': 'esecutore',
  'muro:=': 'avversario',
  'muro:/': 'avversario',      // NUOVO: invasione muro = punto avversario
};
```

`battuta:/`, `ricezione:/` non chiudono il rally (il gioco continua, solo con qualità
peggiore) — nessuna voce necessaria per questi.

## 2. Costanti geometriche condivise

Nuove costanti in `src/domain/courtPositions.ts` (oggi la geometria del campo è sparsa
tra `CampoDaGioco.tsx` e `analysis.ts` con valori duplicati `33.33`/`66.67`; le
centralizziamo qui e le importiamo da entrambi):

```ts
export const RETE_X = 50;
export const LINEA_TRE_METRI_A = 33.33; // 3m dalla rete, lato squadra A
export const LINEA_TRE_METRI_B = 66.67; // 3m dalla rete, lato squadra B
```

## 3. Niente estensione "fuori campo" del campo da gioco

**Decisione presa in fase di piano, non nella revisione originale**: niente margine
tappabile oltre le linee del campo. Motivo: richiederebbe cambiare il `viewBox` di
`CampoDaGioco` e togliere il clamp da `calcolaPunto`, il che rompe la mappatura
pixel→dominio assunta da **ogni** test esistente che usa `fireEvent.click(..., {clientX,
clientY})` sul campo (decine di test in `CampoDaGioco.test.tsx` e nei flussi) — rischio
alto per un beneficio che si ottiene già in altro modo più semplice (sotto).

Il caso "il pallone è uscito/rete" è già coperto senza bisogno di rilevarlo dalla
geometria del tap:
- **Battuta**: resta il bottone esplicito "Errore =" già presente nel passo `esito`
  (invariato, vedi sezione 6).
- **Ricezione, muro, attacco**: la valutazione è derivata/default e **sempre
  correggibile con un tap** sulla striscia "ultima azione" (sezione 5) — se il pallone in
  realtà è uscito, un tap su `=` nella striscia corregge subito, esattamente come il
  "modifica ultimo codice" reale di DataVolley.

Questo elimina completamente la funzione `èFuoriCampo` e ogni cambiamento a
`CampoDaGioco`'s viewBox/click handling dal piano.

## 4. Modulo `domain/valutazioneAutomatica.ts` (nuovo)

Funzioni pure, testabili in isolamento, che calcolano la valutazione da coordinate.
Nessuna dipendenza da React o dai flussi UI.

```ts
// Ricezione: bande di distanza da una "zona ideale" vicino alla rete/palleggiatore.
// squadra = chi riceve (determina su quale meta campo cercare la zona ideale).
export function derivaValutazioneRicezione(squadra: Squadra, destinazione: Punto): Valutazione;

// Muro: derivazione dal punto di rimbalzo dopo il tocco. Ritorna null se il rimbalzo e'
// ambiguo (torna dal lato del muro): il chiamante applica allora il default '+'.
// squadraBloccante = chi ha murato (il rimbalzo "buono" per loro cade nel campo
// dell'attaccante, lontano da lui).
export function derivaValutazioneMuro(squadraBloccante: Squadra, rimbalzo: Punto): Valutazione | null;

// Attacco: incapsula l'UNICO caso geometricamente certo (murato per punto -> '/').
// Ritorna null in ogni altro caso: il chiamante applica allora il default '+'.
export function derivaValutazioneAttaccoCerta(
  toccoMuro: boolean,
  valutazioneMuro: Valutazione | null,
): Valutazione | null {
  if (toccoMuro && valutazioneMuro === '#') return '/';
  return null;
}
```

### Ricezione — soglie precise

Zona ideale per la squadra che riceve = vicino alla propria linea dei 3 metri, y
centrale (dove normalmente si posiziona il palleggiatore). Per la squadra A (riceve
verso `x ∈ [0,50]`): centro ideale `xIdeale = LINEA_TRE_METRI_A` (33.33), `yIdeale = 50`
(centro campo in larghezza). Per la squadra B, speculare: `xIdeale = 100 -
LINEA_TRE_METRI_A` = 66.67, stesso `yIdeale = 50`.

Calcolo: `distanza = Math.hypot(destinazione.x - xIdeale, destinazione.y - yIdeale)`
(nello spazio di dominio 0-100 su entrambi gli assi, non nel viewBox compresso).

| distanza dalla zona ideale | valutazione |
|---|---|
| ≤ 8 | `#` |
| ≤ 16 | `+` |
| ≤ 26 | `!` |
| ≤ 40 | `-` |
| > 40 | `/` |

Le soglie sono calibrate su un campo 100×100 (18m×9m): 8 unità ≈ 1.4m, 16 ≈ 2.9m, 26 ≈
4.7m, 40 ≈ 7.2m — plausibili per distinguere "in mezzo alle mani del palleggiatore" da
"a malapena giocabile", ma **vanno verificate/tarate con test dal vivo** dopo
l'implementazione (annotato esplicitamente come rischio, non falsa precisione). `=`
(errore totale, es. rotazione/pallone a terra senza tocco) non è mai derivato
geometricamente: si ottiene solo correggendo sulla striscia.

### Muro — soglie precise

Punto di riferimento: il "lato lontano" del campo dell'attaccante rispetto alla rete,
cioè vicino alla linea di fondo della squadra che ha attaccato. Se la squadra bloccante
è A (quindi l'attaccante è B, il rimbalzo torna verso `x > 50`): il rimbalzo è tanto
migliore quanto più è vicino a `x = 100` (fondo campo B). Definiamo `profondità =
rimbalzo.x - 50` (per muro di A; per muro di B, `profondità = 50 - rimbalzo.x`).

| condizione | valutazione |
|---|---|
| `profondità ≥ 30` | `#` (rimbalzo profondo, palla morta) |
| `profondità ≥ 15` | `+` |
| `profondità ≥ 0` | `!` |
| `profondità < 0` (rimbalzo torna dal lato del muro) | `null` → il chiamante applica il default `+` |

## 5. Componente `StrisciaUltimaAzione` (nuovo)

Sostituisce l'uso di `ValutazioneButtons` come passo di flusso obbligato per ricezione,
muro e attacco. Appare in `LiveScoutingScreen` sotto il campo, dopo ogni azione
completata con valutazione derivata/default, finché non arriva il tap successivo che
avvia una nuova azione (nessun timeout automatico: lo scout deve poter correggere anche
se ci mette più di qualche secondo).

- Mostra: fondamentale + giocatore + valutazione applicata (es. "Attacco #7: +").
- 5 bottoni compatti (`= / - ! + #`, esclude quello già applicato) per correggere con un
  tap: la correzione chiama `correggiValutazione(azioneId, nuovaValutazione)`, nuova
  azione dello store `liveMatchStore` che fa un update (non delete+reinsert) sia lato DB
  (`db/scouting.ts`) sia sull'array locale `azioni`.
- **Nessuna gestione esplicita di riapertura/chiusura rally necessaria**: il punteggio e
  la rotazione sono sempre ricalcolati da zero da `deriveSetState`/
  `determinaEsitoAutomatico` a partire dall'array `azioni` corrente (vedi
  `domain/reducer.ts`) — cambiare la `valutazione` di un'azione e aggiornare lo store è
  sufficiente, il prossimo render ricalcola automaticamente punteggio/rotazione/rally
  aperto con il nuovo valore.
- Appare anche per battuta/ricezione derivate con certezza (nessuna enfasi "serve
  conferma", solo feedback coerente); non appare quando la valutazione viene da un tap
  esplicito già oggi presente (Ace#/Errore= su battuta).

## 6. Modifiche ai flussi

### `BattutaFlow.tsx`

- Passo `destinazione`, passo `esito`: **invariati** (Ace # / Errore = espliciti + tap
  giocatore ricevente, fast-path esistente mantenuto).
- Passo `ricezione-valutazione` **rimosso**: dopo `ricezione-origine`, la valutazione si
  calcola con `derivaValutazioneRicezione(squadraRicevente, riceOrigine)` e si completa
  subito (niente tap).
- `DERIVA_BATTUTA_DA_RICEZIONE` aggiorna la voce mancante: `'/': '/'`.

### `RicezioneFlow.tsx` (standalone)

- Passo `valutazione` **rimosso**: dopo `origine`, valutazione derivata allo stesso modo
  di sopra, completamento automatico.

### `AttaccoMuroFlow.tsx`

- Passo `valutazione` per attacco **rimosso** come passo bloccante: si chiama
  `derivaValutazioneAttaccoCerta(toccoMuro, toccoValutazione)`; se ritorna `null`, si
  applica default `+`. In entrambi i casi si completa subito.
- Passo `valutazione` per muro **rimosso** come passo bloccante: si applica
  `derivaValutazioneMuro(squadraBloccante, destinazione)`; se ritorna `null`, default
  `+`. Completamento immediato.
- Passo `tocco-valutazione` (valutazione del tocco muro durante un attacco murato):
  stessa logica di `derivaValutazioneMuro`, applicata al punto salvato in `destinazione`
  durante il passo `rimbalzo-muro` (il punto dove la palla atterra dopo il tocco) — **non**
  a `toccoOrigine`, che è sempre vicino alla rete (dentro la fascia muro) e quindi non
  porta nessuna informazione su quanto il tocco sia stato efficace. Default `+` se
  ambiguo, stessa formula/soglie della sezione "Muro" sopra.
- Risultato netto: **il tap "valutazione" scompare dal flusso attacco/muro**, sostituito
  da completamento automatico + eventuale correzione post-hoc sulla striscia.

## 7. Colori traiettoria

`Traiettoria` (in `CampoDaGioco.tsx`) guadagna un campo:

```ts
export interface Traiettoria {
  origine: Punto;
  destinazione: Punto;
  esito: 'punto_esecutore' | 'continua' | 'punto_avversario';
}
```

Calcolato in `LiveScoutingScreen.tsx` dove oggi si costruisce `ultimaTraiettoria`,
usando `TABELLA_CHIUSURA`/`determinaEsitoAutomatico` sulla singola azione: se la sua
combinazione fondamentale+valutazione è in `TABELLA_CHIUSURA` con `'esecutore'` →
`punto_esecutore`; con `'avversario'` → `punto_avversario`; altrimenti `continua`.

Colori linea/pallini in `CampoDaGioco.tsx`:
- `punto_esecutore` → nero (`#000000` con contorno bianco sottile, `strokeWidth={0.2}`,
  per restare visibile sul campo scuro).
- `continua` → verde (`#22c55e`).
- `punto_avversario` → rosso (`#ef4444`).

La linea "in corso" (`origineSelezionata`+`destinazioneSelezionata` durante la
valutazione, oggi ambra) resta ambra: non ha ancora un esito, è ancora provvisoria.

## 8. Test

- `domain/valutazioneAutomatica.test.ts` (nuovo): tabella di casi per ciascuna funzione
  di derivazione, incluse le soglie esatte (bordi delle bande).
- `domain/reducer.test.ts`: casi aggiunti per `attacco:/` e `muro:/` come chiusure.
- `features/live-scouting/BattutaFlow.test.tsx`, `RicezioneFlow.test.tsx`,
  `AttaccoMuroFlow.test.tsx`: aggiornare i test esistenti che oggi cliccano un bottone di
  valutazione — ora la valutazione emerge dal tap di destinazione, i test verificano il
  valore derivato invece del click sul bottone.
- `features/live-scouting/LiveScoutingScreen.test.tsx`: i test che passano per un
  attacco/muro con tap di valutazione esplicito vanno riscritti sul nuovo
  comportamento; il test dell'ace via battuta+ricezione resta invariato nella parte
  battuta, cambia solo l'ultimo tap (nessun tap di valutazione ricezione).
- Nuovo componente `StrisciaUltimaAzione`: test dedicato per correzione post-hoc,
  inclusa la verifica che punteggio/rally si aggiornino di conseguenza dopo la
  correzione (nessuna logica esplicita di riapertura da testare separatamente: si
  verifica solo che `statoDerivato()` rifletta il nuovo valore).
- `components/CampoDaGioco.test.tsx`: nessuna modifica alla geometria di click; solo
  nuovi test per i colori della traiettoria in base a `esito`.

## 9. Rischi e cose da verificare dal vivo

- Le soglie numeriche di `derivaValutazioneRicezione`/`derivaValutazioneMuro` sono una
  prima stima ragionevole ma **non testata con scout reali**: vanno provate durante una
  scouting dal vivo e probabilmente tarate. Non è un blocco all'implementazione (i
  default sono facilmente modificabili, sono costanti isolate in un modulo puro), ma va
  comunicato chiaramente: non aspettarsi che siano perfette al primo colpo.
- Senza rilevamento geometrico del "fuori campo" per ricezione/muro/attacco, lo scout
  deve ricordarsi di usare la striscia di correzione per i veri errori (`=`) — è un tap
  in più rispetto a un'ipotetica derivazione perfetta, ma è lo stesso identico
  compromesso che fa DataVolley stesso nella scouting da tastiera (default + correzione
  invece di piena automazione).
