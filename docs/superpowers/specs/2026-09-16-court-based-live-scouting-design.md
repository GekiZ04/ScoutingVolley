# Design: scouting live su campo visuale (click & scout style)

Data: 2026-09-16

## Obiettivo

Sostituire l'attuale input astratto (lista giocatori a bottoni + `ZoneGrid` a celle
numerate 1-9) con un'interazione basata su un **campo da pallavolo visuale**, sul
modello di Click&Scout/DataVolley: si tocca il giocatore posizionato sul campo secondo
la rotazione corrente, poi si traccia la traiettoria della palla toccando il punto di
partenza e il punto di arrivo, ovunque sull'intero campo (entrambe le metà). Il campo
resta sempre visibile durante tutti gli step del flusso, inclusa la valutazione.

Questo design sostituisce/estende la sezione "Flusso di scouting live" del design
originale (`2026-09-16-volleyball-scouting-pwa-design.md`); tutto il resto di
quel documento (motore di replay, statistiche, storico, PWA/offline) resta valido e non
è toccato da questo cambiamento.

## Componente `CampoDaGioco`

Nuovo componente SVG condiviso (`src/components/CampoDaGioco.tsx`), sostituisce
`ZoneGrid` (rimosso). Rende sempre il campo intero: entrambe le metà, rete verticale al
centro, linee di attacco (3m), linee laterali/di fondo.

**Sistema di coordinate**: percentuali continue su tutto il campo.
- `x`: 0 → 100, lunghezza intera del campo (18m). Rete fissa a `x = 50`.
- `y`: 0 → 100, larghezza del campo (9m).
- Squadra A occupa sempre `x ∈ [0, 50]` (fondo campo a `x=0`, rete a `x=50`).
- Squadra B occupa sempre `x ∈ [50, 100]` (rete a `x=50`, fondo campo a `x=100`).
- Le squadre non si scambiano lato virtuale a fine set: è un campo astratto, non
  rispecchia il lato fisico reale in palestra.

**Marker giocatori**: 12 marker sempre visibili (6 per squadra), posizionati secondo la
rotazione corrente (`rotazioneA`/`rotazioneB` da `statoDerivato()`), con la geometria
standard delle zone 1-6 (3 a rete, 3 sul fondo), speculare tra le due metà campo. Ogni
marker mostra il numero di maglia. Sono sempre marker nominali (giocatore reale dal
roster) — non viene introdotta una modalità "giocatore anonimo": è coerente con il
comportamento attuale, dove il campo `giocatoreId: null` esiste nel modello dati ma non
è mai esposto da nessun flusso UI.

**Modalità di interazione** (controllate dal componente chiamante via prop):
- `seleziona-giocatore`: solo i 6 marker della squadra pertinente sono attivi/evidenziati
  (tap → id giocatore); gli altri 6 sono visibili ma non cliccabili.
- `seleziona-punto`: tap libero in un punto qualsiasi del campo (comprese entrambe le
  metà) → coordinate `{x, y}`, calcolate dalla posizione del click relativa al
  `getBoundingClientRect()` dell'SVG.
- `seleziona-punto-con-fascia-muro`: come sopra, più una fascia sempre presente e
  cliccabile lungo la rete, sul lato del muro avversario (vedi sotto "Tocco muro").

Durante la selezione del punto di destinazione, se è già stato scelto un punto di
origine, il componente disegna una linea dal punto di origine al punto corrente (hover
non necessario su touch: si può semplicemente mostrare il marker dell'origine finché non
arriva il tap di destinazione).

## Layout: campo sempre visibile

Lo schermo di scouting live cambia layout: il campo (`CampoDaGioco`) occupa l'area
principale ed è **sempre montato**, per tutta la durata del flusso della singola azione
(tipo battuta / valutazione / tap punti). I controlli non-campo (bottoni tipo battuta,
bottoni valutazione, bottone bivio Muro/Attacco) occupano una fascia fissa sovrapposta
(es. in basso), mai a schermo intero: il campo non viene mai coperto del tutto.

## Flusso a 3 tap per fondamentale

Principio generale confermato: il tap che identifica il giocatore è **sempre separato**
dal tap che indica il punto di partenza reale della traiettoria (che può non coincidere
con la posizione di rotazione, es. dopo uno spostamento in salto).

- **Battuta** (giocatore dedotto, P1 al servizio — nessun tap giocatore):
  tipo battuta (bottoni) → valutazione (bottoni) → tap **origine** sul campo → tap
  **destinazione** sul campo → salva. *(2 tap sul campo)*
- **Ricezione** (fondamentale implicito, segue sempre una battuta):
  tap **giocatore** sul campo (marker rotazione ricevente) → valutazione → tap
  **origine** → tap **destinazione** (nuovo: prima la ricezione non aveva destinazione)
  → salva. *(1 tap giocatore + 2 tap campo)*
- **Attacco** (fondamentale implicito la prima volta, poi bivio esplicito):
  tap **giocatore** sul campo → valutazione → tap **origine** → tap **destinazione**
  (con fascia muro sempre presente, vedi sotto) → salva.
- **Muro** (via bivio esplicito dopo un attacco che non chiude il rally): tap
  **[Muro]** nel bivio → tap **giocatore** sul campo (marker squadra a muro) →
  valutazione → tap **origine** → tap **destinazione** → salva. Flusso invariato
  nella struttura, solo i tap zona/direzione diventano tap sul campo.

## Tocco muro sull'attacco

Durante il tap di **destinazione** di un'azione **attacco**, il campo mostra sempre una
fascia sottile lungo la rete, sul lato del muro avversario (larghezza fissa, es. 5% della
lunghezza campo, immediatamente dall'altra parte della rete rispetto a chi attacca).

Se lo scout tocca quella fascia invece di un punto normale di destinazione:
1. Si registra `toccoMuro: true` sull'azione attacco.
2. Il campo richiede un **tap successivo** per il punto di rimbalzo reale della palla
   dopo il tocco: quel punto diventa la `destinazione` salvata dell'azione (l'eventuale
   destinazione "mirata" originale non viene registrata separatamente).
3. Si salva un'unica azione `attacco` con `toccoMuro: true` — **non** si apre
   automaticamente il bivio "Muro" separato. Il bivio esplicito Muro/Attacco resta
   comunque disponibile invariato per quando lo scout vuole loggare il muro come azione
   a sé stante, con proprio giocatore/valutazione (es. muro punto secco, muro errore).

Se lo scout non tocca la fascia, il flusso è quello standard (`toccoMuro: false`,
destinazione = punto scelto normalmente).

## Modello dati

In `domain/types.ts` e `db/schema.ts`, interfaccia `Azione`:

```ts
export interface Punto { x: number; y: number; } // percentuali 0-100 sul campo intero

export interface Azione {
  // ...campi invariati (id, rallyId, setId, ordine, squadra, giocatoreId,
  // fondamentale, tipoBattuta, valutazione, timestamp)
  origine: Punto | null;        // sostituisce `zona: number | null`
  destinazione: Punto | null;   // sostituisce `direzione: number | null`
  toccoMuro: boolean;           // nuovo, solo rilevante per fondamentale === 'attacco'
}
```

`toccoMuro` è sempre `false` per battuta/ricezione/muro (non applicabile), `true`/`false`
per attacco secondo l'interazione sopra.

Nessuna migrazione dati necessaria: il progetto non ha ancora partite reali in
produzione, lo schema Dexie può cambiare direttamente in questa versione.

## Impatti su `domain/analysis.ts`

`classificaDirezione` non usa più una lookup per numero di zona: confronta la **fascia
laterale** (terzo dell'asse `y`, indipendente dal lato rete) del punto di origine e del
punto di destinazione.

```ts
function fasciaLaterale(y: number): 'sinistra' | 'centro' | 'destra' {
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
```

Stessa funzione `fasciaLaterale` riusata per il breakdown dei centrali (oggi basato su
zone destinazione 6/5/1): si sostituisce con la distribuzione delle destinazioni per
fascia laterale (sinistra/centro/destra), stesso significato pratico, calcolo continuo.
`distribuzioneDirezioniAttacco` cambia firma di conseguenza (ritorna conteggi per
`'sinistra' | 'centro' | 'destra'` invece che per numero di zona).

**Murato**: `isMurato` resta come oggi (rileva un'azione muro successiva nello stesso
rally con valutazione `#` della squadra avversaria) **in OR con** il nuovo flag: un
attacco con `toccoMuro: true` è considerato murato anche senza un'azione muro separata
nello stesso rally. La percentuale "% murato" in `analizzaTendenze` riflette entrambi i
casi.

## Impatti su export CSV

In `generaCsvAzioni`, le colonne `zona`/`direzione` sono sostituite da
`origine_x, origine_y, destinazione_x, destinazione_y` (numeri arrotondati a 1
decimale, vuoti se `null`), più una colonna `toccoMuro` (`si`/`no`, vuota per i
fondamentali dove non è applicabile). `generaCsvBoxScore` non cambia (non usa
zona/direzione). L'export PDF non cambia (usa efficienza per fondamentale, non le
coordinate).

## Cosa non cambia

Motore di replay (punteggio, rotazione, chiusura rally, sostituzioni/timeout),
statistiche per fondamentale/valutazione (`domain/stats.ts`), storico partite, PWA/
offline, gestione squadre/roster, setup partita.

## Componenti rimossi

`src/components/ZoneGrid.tsx` e il relativo test vengono rimossi, sostituiti da
`CampoDaGioco`.
