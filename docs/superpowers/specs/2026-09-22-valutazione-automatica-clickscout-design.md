# Design: valutazione automatica stile Click&Scout/DataVolley

Data: 2026-09-22

## Obiettivo

Avvicinare il funzionamento della scouting live a quello di Click&Scout (touch,
"due tap") e alla notazione standard DataVolley su cui si appoggia, mantenendo il
flusso a tap sul campo già costruito nei design precedenti. Concretamente:

1. Portare la scala di valutazione da 5 a 6 simboli (`= / - ! + #`), come DataVolley,
   con il significato corretto per ciascun fondamentale.
2. Eliminare il tap esplicito di valutazione per battuta e ricezione, derivandola dalla
   geometria del tap di destinazione (dove è affidabile farlo).
3. Per muro e attacco, dove la geometria da sola non basta, applicare un default (il
   valore più comune, come fa DataVolley) e permettere una correzione con un tap sulla
   striscia "ultima azione" — non un passo di flusso in più.
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
export const CAMPO_MIN = 0;
export const CAMPO_MAX = 100;
```

## 3. Area "fuori campo" tappabile su `CampoDaGioco`

Oggi il `viewBox` SVG coincide esattamente con il rettangolo di gioco (`0 0 100 50`) e
`calcolaPunto` clampa (clamp) ogni tap dentro `[0,100]×[0,100]`: non esiste modo di
toccare "fuori" per registrare un pallone che esce. Serve un margine visibile e
tappabile oltre le linee.

- `viewBox` diventa `-15 -8 130 66` (margine ~15% oltre ogni lato in x, proporzionale in
  y compresso). Il rettangolo del campo (`rect x=0 y=0 width=100 height=ALTEZZA_VIEWBOX`)
  resta uguale, disegnato "dentro" al viewBox più ampio; il margine esterno ha un
  riempimento leggermente più scuro per essere visivamente distinto (es.
  `fill="#0c1220"` contro il campo `bg-cyan-800`).
- `calcolaPunto` non clampa più a `[0,100]`: restituisce le coordinate reali anche se
  negative o `>100`, calcolate dalla stessa proporzione `(clientX-rect.left)/rect.width`
  ora scalata sul nuovo viewBox più ampio invece che sul rettangolo di gioco.
- Un punto è "fuori" quando `x < CAMPO_MIN || x > CAMPO_MAX || y < CAMPO_MIN || y >
  CAMPO_MAX`. Questo è il predicato `èFuoriCampo(punto: Punto): boolean` esportato da
  `domain/valutazioneAutomatica.ts` (vedi sotto).
- I marker giocatore, la fascia muro, le linee dei 3 metri restano invariati (sono già
  tutti dentro `[0,100]`); solo l'area tappabile e il rendering del margine cambiano.

## 4. Modulo `domain/valutazioneAutomatica.ts` (nuovo)

Funzioni pure, testabili in isolamento, che calcolano la valutazione da coordinate.
Nessuna dipendenza da React o dai flussi UI.

```ts
export function èFuoriCampo(punto: Punto): boolean;

// Ricezione: bande di distanza da una "zona ideale" vicino alla rete/palleggiatore.
// squadra = chi riceve (determina su quale meta campo cercare la zona ideale).
export function derivaValutazioneRicezione(squadra: Squadra, destinazione: Punto): Valutazione;

// Muro: derivazione dal punto di rimbalzo dopo il tocco.
// squadraBloccante = chi ha murato (il rimbalzo "buono" per loro cade nel campo
// dell'attaccante, lontano da lui).
export function derivaValutazioneMuro(squadraBloccante: Squadra, rimbalzo: Punto): Valutazione;

// Attacco: incapsula i DUE soli casi geometricamente certi (fuori campo -> '=';
// murato per punto -> '/'). Ritorna null in ogni altro caso: il chiamante applica
// allora il default '+' (il default+correzione è UI, non derivazione geometrica,
// quindi non vive in questa funzione).
export function derivaValutazioneAttaccoCertà(
  destinazione: Punto,
  toccoMuro: boolean,
  valutazioneMuro: Valutazione | null,
): Valutazione | null {
  if (èFuoriCampo(destinazione)) return '=';
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
| fuori campo (`èFuoriCampo`) | `/` |
| ≤ 8 | `#` |
| ≤ 16 | `+` |
| ≤ 26 | `!` |
| ≤ 40 | `-` |
| > 40 | `-` (clamp: non scende sotto `-` per via geometrica; `=` resta solo via tap esplicito Ace/Errore) |

Le soglie sono calibrate su un campo 100×100 (18m×9m): 8 unità ≈ 1.4m, 16 ≈ 2.9m, 26 ≈
4.7m, 40 ≈ 7.2m — plausibili per distinguere "in mezzo alle mani del palleggiatore" da
"a malapena giocabile", ma **vanno verificate/tarate con test dal vivo** dopo
l'implementazione (annotato esplicitamente come rischio, non falsa precisione).

### Muro — soglie precise

Punto di riferimento: il "lato lontano" del campo dell'attaccante rispetto alla rete,
cioè vicino alla linea di fondo della squadra che ha attaccato. Se la squadra bloccante
è A (quindi l'attaccante è B, il rimbalzo torna verso `x > 50`): il rimbalzo è tanto
migliore quanto più è vicino a `x = 100` (fondo campo B) o agli angoli laterali (`y`
vicino a 0 o 100). Definiamo `profondità = rimbalzo.x - 50` (per muro di A; per muro di
B, `profondità = 50 - rimbalzo.x`).

| condizione | valutazione |
|---|---|
| fuori campo (rete/antenna non derivabile da un punto valido → questo path non si attiva mai da `èFuoriCampo`, resta gestito come default+correzione) | — |
| `profondità ≥ 30` | `#` (rimbalzo profondo, palla morta) |
| `profondità ≥ 15` | `+` |
| `profondità ≥ 0` | `!` |
| `profondità < 0` (rimbalzo torna dal lato del muro) | default `+` con correzione (ambiguo, serve giudizio umano) |

## 5. Componente `StrisciaUltimaAzione` (nuovo)

Sostituisce l'uso di `ValutazioneButtons` come passo di flusso obbligato per attacco e
muro (quando la derivazione geometrica non è certa). Appare in `LiveScoutingScreen`
sotto il campo, per ~3 secondi dopo ogni azione completata con valutazione
default-applicata, o finché non arriva il tap successivo:

- Mostra: fondamentale + giocatore + valutazione applicata (es. "Attacco #7: +").
- 5 bottoni compatti (`= / - ! + #`, esclude quello già applicato) per correggere con un
  tap: la correzione aggiorna l'ultima `Azione` salvata (stesso meccanismo già esistente
  per "annulla ultima azione" in `liveMatchStore`, esteso con un `correggiValutazione(id,
  nuovaValutazione)` che fa update invece di delete+reinsert).
- Se il rally si chiude per via della valutazione applicata (es. default `+` non chiude,
  ma una correzione a `#` o `=` sì), la correzione deve poter **riaprire/richiudere** il
  rally di conseguenza — usa la stessa logica di `determinaEsitoAutomatico` già presente,
  ricalcolata dopo la correzione.
- Non appare per battuta/ricezione (sempre derivate con certezza dalla geometria, tranne
  il fast-path Ace/Errore esplicito già esistente) né quando la valutazione è già certa
  geometricamente (`#`/`=`/`/` derivati, niente da correggere nella maggioranza dei casi
  — la striscia appare comunque ma senza enfasi "serve conferma", solo come feedback).

## 6. Modifiche ai flussi

### `BattutaFlow.tsx`

- Passo `destinazione`: se `èFuoriCampo(punto)` → completa subito con `valutazione: '='`,
  nessun passo `esito` (rally già chiuso via `battuta:=`).
- Se dentro campo: passo `esito` invariato (Ace # / Errore = espliciti + tap giocatore
  ricevente, fast-path mantenuto come discusso).
- Passo `ricezione-valutazione` **rimosso**: dopo `ricezione-origine`, la valutazione si
  calcola con `derivaValutazioneRicezione(squadraRicevente, riceOrigine)` e si completa
  subito (niente tap).
- `DERIVA_BATTUTA_DA_RICEZIONE` aggiorna la voce mancante: `'/': '/'`.

### `RicezioneFlow.tsx` (standalone)

- Passo `valutazione` **rimosso**: dopo `origine`, valutazione derivata allo stesso modo
  di sopra, completamento automatico. Fast-path Ace/Errore non esiste qui (questo flusso
  non ha mai avuto quell'opzione: se serve gestire una ricezione `=` standalone, resta
  un caso limite fuori scope, gestibile con "annulla ultima azione" + chiusura manuale
  rally se necessario, come già possibile oggi).

### `AttaccoMuroFlow.tsx`

- Passo `valutazione` per attacco **rimosso** come passo bloccante: si chiama
  `derivaValutazioneAttaccoCertà(destinazione, toccoMuro, toccoValutazione)` (che da
  sola copre sia il caso fuori campo sia il caso murato per punto — vedi sezione 4); se
  ritorna `null` (caso non certo), si applica default `+`. In entrambi i casi si
  completa subito — la correzione avviene dopo, sulla striscia.
- Passo `valutazione` per muro **rimosso** come passo bloccante: si applica
  `derivaValutazioneMuro`, con fallback a default `+` se il rimbalzo è ambiguo (vedi
  tabella sopra), completamento immediato.
- Passo `tocco-valutazione` (valutazione del tocco muro durante un attacco murato):
  stessa logica di `derivaValutazioneMuro` applicata al punto di rimbalzo del tocco,
  default+correzione.
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
- `punto_esecutore` → nero (`#000000` con contorno bianco sottile per restare visibile
  sul campo scuro — nero puro su sfondo `bg-cyan-800`/`bg-slate-950` sarebbe leggibile,
  ma un contorno da 0.2 di larghezza in bianco aiuta la resa su schermi diversi).
- `continua` → verde (`#22c55e`).
- `punto_avversario` → rosso (`#ef4444`).

La linea "in corso" (`origineSelezionata`+`destinazioneSelezionata` durante la
valutazione, oggi ambra) resta ambra: non ha ancora un esito, è ancora provvisoria.

## 8. Test

- `domain/valutazioneAutomatica.test.ts` (nuovo): tabella di casi per ciascuna funzione
  di derivazione, incluse le soglie esatte (bordi delle bande) e i casi `èFuoriCampo`.
- `domain/reducer.test.ts`: casi aggiunti per `attacco:/` e `muro:/` come chiusure.
- `domain/courtPositions.test.ts`: eventuali nuove costanti esportate.
- `components/CampoDaGioco.test.tsx`: aggiornare per il nuovo viewBox/margine e
  `calcolaPunto` senza clamp; nuovo test per tap nel margine "fuori".
- `features/live-scouting/BattutaFlow.test.tsx`,
  `RicezioneFlow.test.tsx`(non esiste ancora come file dedicato, verificare),
  `AttaccoMuroFlow.test.tsx`: aggiornare i test esistenti che oggi cliccano un bottone di
  valutazione — ora la valutazione emerge dal tap di destinazione, i test verificano il
  valore derivato invece del click sul bottone.
- `features/live-scouting/LiveScoutingScreen.test.tsx`: alcuni test già presenti
  assumono valutazioni specifiche via tap esplicito (es. "Ace #" per battuta resta
  invariato, ma i test che passano per un attacco/muro con tap di valutazione esplicito
  vanno riscritti sul nuovo comportamento).
- Nuovo componente `StrisciaUltimaAzione`: test dedicato per correzione post-hoc,
  inclusa la riapertura/richiusura del rally quando la correzione cambia l'esito.

## 9. Rischi e cose da verificare dal vivo

- Le soglie numeriche di `derivaValutazioneRicezione`/`derivaValutazioneMuro` sono una
  prima stima ragionevole ma **non testata con scout reali**: vanno provate durante una
  scouting dal vivo e probabilmente tarate. Non è un blocco all'implementazione (i
  default sono facilmente modificabili, sono costanti isolate in un modulo puro), ma va
  comunicato chiaramente: non aspettarsi che siano perfette al primo colpo.
- L'estensione del margine tappabile su `CampoDaGioco` è il cambiamento con più
  superficie di rischio UI (tocchi accidentali nel margine durante altri passi del
  flusso, es. selezione giocatore) — va verificato che il margine sia attivo solo nei
  passi `seleziona-punto`/`seleziona-punto-con-fascia-muro`, mai durante
  `seleziona-giocatore*`, per evitare tap fuori-schermo accidentali che chiudono rally
  per sbaglio.
