# Design: PWA di scouting live pallavolo per iPad

Data: 2026-09-16

## Obiettivo

Costruire una Progressive Web App per iPad, ispirata a Click&Scout/DataVolley, per lo
scouting punto-per-punto di una partita di pallavolo in tempo reale, **completamente
offline** durante la partita (spesso senza connessione in palestra). Deve permettere di
codificare ogni azione con pochi tap, aggiornare punteggio/rotazione automaticamente,
mostrare statistiche live e supportare decisioni tattiche rapide (es. cambio giocatore)
da bordo campo. V1 senza backend, nessun account, nessuna sync multi-dispositivo.

## Stack tecnico

- React + TypeScript + Vite
- `vite-plugin-pwa` per service worker e installabilità ("Aggiungi a Home Screen" su iPadOS)
- IndexedDB via Dexie.js come unico storage, nessun backend in v1
- Tailwind CSS, UI touch-first (target grandi, no hover)
- Zustand per lo stato della partita in corso

## Struttura del progetto

```
src/
  app/                  # App shell, routing
  db/                   # Schema Dexie + funzioni di accesso dati
  domain/               # Logica di dominio pura (no React/Zustand)
    events.ts           # Tipi degli eventi/azione
    reducer.ts           # replay(eventi) -> stato derivato (punteggio, rotazione, formazione)
    stats.ts             # statistiche pure da array di eventi
    analysis.ts           # analisi tendenze attacco (direzione, murato, colpo principale)
    rotation.ts           # rotazione semplificata + gestione sostituzioni
  features/
    teams/               # Gestione squadre/roster (CRUD)
    match-setup/          # Creazione partita, formazione titolare, rotazione iniziale
    live-scouting/        # Schermata di scouting live (il cuore dell'app)
    live-analysis/         # Pannello overlay "Analisi live"
    stats-dashboard/      # Dashboard statistiche live e storiche
    history/               # Storico partite/set salvati
    export/                # Export CSV/PDF
  store/                 # Zustand store (eventi del set corrente + stato UI transitorio)
  components/            # Componenti UI condivisi
  pwa/                    # Config service worker
```

Principi:
- `domain/` è puro TypeScript, testabile in isolamento, contiene tutte le regole
  (rotazione, chiusura rally, statistiche, analisi tendenze). È il codice più delicato
  (bug qui = dati sbagliati in partita), va coperto da test unitari.
- Zustand tiene solo l'array di eventi del set corrente + stato UI transitorio. Non
  duplica punteggio/rotazione: sono derivati chiamando `reducer.ts`.
- Dexie è la fonte di verità durevole (squadre, partite, set, eventi). Zustand è solo
  la partita *in corso*.

## Modello dati (Dexie)

```ts
interface Team {
  id: string;
  nome: string;
  createdAt: string; // ISO
}

interface Player {
  id: string;
  teamId: string;
  numero: number;
  nome: string;
  ruolo: 'palleggiatore' | 'opposto' | 'schiacciatore' | 'centrale' | 'libero';
  attivo: boolean; // soft-archiviazione, non si cancella per preservare lo storico
}

interface Match {
  id: string;
  data: string;                          // ISO date
  squadraAId: string;
  squadraBId: string;
  squadraRiferimentoId: string | null;   // "la mia squadra", se presente; null in pre-scout tra due terze
  formatoSet: 3 | 5;                     // al meglio di 3 o 5 (informativo, la chiusura è sempre manuale/confermata)
  puntiSet: number;                      // target punti per set normale, default 25, editabile (partite amichevoli)
  puntiSetDecisivo: number;              // target punti per l'eventuale set decisivo, default 15, editabile
  stato: 'in_corso' | 'conclusa';
  note?: string;
}

interface SetPallavolo {
  id: string;
  matchId: string;
  numero: number;                        // 1..5
  formazioneInizialeA: string[];         // 6 playerId in ordine posizione P1..P6
  formazioneInizialeB: string[];
  primaSquadraAlServizio: 'A' | 'B';
  stato: 'in_corso' | 'concluso';
  vincitore: 'A' | 'B' | null;
}

interface Rally {
  id: string;
  setId: string;
  numero: number;                        // sequenza nel set, parte da 1
  squadraAlServizio: 'A' | 'B';
  esito: 'punto_A' | 'punto_B' | null;   // null finché il rally è aperto
  chiusuraManuale: boolean;              // true se chiuso a mano invece che dall'euristica automatica
}

interface Azione {
  id: string;
  rallyId: string;
  setId: string;                         // denormalizzato per query dirette
  ordine: number;                        // ordine dentro il rally
  squadra: 'A' | 'B';
  giocatoreId: string | null;            // null se non identificato (es. avversario non tracciato)
  fondamentale: 'battuta' | 'ricezione' | 'attacco' | 'muro';
  tipoBattuta: 'flottante' | 'salto_flottante' | 'salto_spin' | null; // solo per battuta
  valutazione: '#' | '+' | '!' | '-' | '=';
  zona: number | null;                   // origine, griglia standard (vedi sotto)
  direzione: number | null;              // destinazione, griglia standard; solo battuta/attacco/muro
  timestamp: string;                     // ISO, automatico al salvataggio — ancora per sync video (soprattutto battuta)
}

interface Sostituzione {
  id: string; setId: string;
  dopoRallyNumero: number;               // 0 = prima dell'inizio del set
  squadra: 'A' | 'B';
  giocatoreEsceId: string;
  giocatoreEntraId: string;
}

interface Timeout {
  id: string; setId: string;
  dopoRallyNumero: number;
  squadra: 'A' | 'B';
}
```

Indici principali: `Player.teamId`, `Match.stato+data`, `SetPallavolo.matchId`,
`Rally.setId+numero`, `Azione.rallyId+ordine`, `Azione.setId+giocatoreId`.

Nessun campo derivato salvato (niente punteggio/rotazione cache): tutto si ricostruisce
da `Rally`+`Azione` via `reducer.ts` (event sourcing).

### Numerazione zone (origine e destinazione)

Griglia touch-friendly ma etichettata secondo la convenzione standard italiana, non
sequenziale:

```
Zona (origine, 6 celle)     Direzione (destinazione, 9 celle)
   4   3   2                    7   8   9   ← corto/pallonetto, vicino rete
   5   6   1                    4   3   2   ← medio campo
                                 5   6   1   ← profondo/fondo campo
```

## Motore di replay (`domain/reducer.ts` + `rotation.ts`)

Event sourcing: lo stato corrente (punteggio, rotazione, formazione in campo) non è mai
salvato direttamente, è sempre **derivato** rifacendo il replay della sequenza di
`Rally`+`Azione` (+ `Sostituzione`) del set.

**Algoritmo (`deriveSetState`)**:
1. Inizializza rotazione A/B da `formazioneIniziale`, punteggio 0-0, `squadraAlServizio`
   dal set.
2. Scorre i rally in ordine. Prima di ciascuno, applica eventuali `Sostituzioni`
   registrate subito prima.
3. Determina l'esito del rally: se `chiusuraManuale` usa l'esito salvato; altrimenti
   applica questa tabella euristica (solo battuta/attacco/muro possono chiudere
   automaticamente; ricezione non chiude mai da sola):

   | Fondamentale | Valutazione | Esito |
   |---|---|---|
   | battuta | `#` (ace) | punto squadra al servizio |
   | battuta | `=` (errore) | punto squadra ricevente |
   | attacco | `#` (punto) | punto squadra attaccante |
   | attacco | `=` (errore) | punto squadra difendente |
   | muro | `#` (punto) | punto squadra a muro |
   | muro | `=` (errore) | punto squadra attaccante |
   | altri casi | qualsiasi | rally continua |

4. Se il punto va alla squadra che non era al servizio → cambio palla: quella squadra
   ruota di una posizione (P2→P1, P1→P6, ... P3→P2) e diventa `squadraAlServizio`. Se il
   punto va a chi già serviva, nessuna rotazione.
5. Rotazione **semplificata**: nessuna validazione overlap o regole libero FIVB.
   Sostituzioni (incluso l'ingresso/uscita del libero) sono sempre manuali via il record
   `Sostituzione`, applicate come override rapido, mai bloccate da regole automatiche.

**Fine set/partita — flessibile per partite amichevoli**: `puntiSet`/`puntiSetDecisivo`
sono parametri modificabili del `Match` (default 25/15). Al raggiungimento del target
punti compare un banner non bloccante ("Set al punto 25-20 — chiudere?") che lo scout
può confermare o ignorare per continuare oltre. Due controlli manuali sono sempre
visibili: **"Chiudi set"** e **"Chiudi partita"**, che chiedono conferma di chi ha vinto
(pre-compilato dal punteggio se univoco, editabile) — funzionano anche per partite che
si fermano a metà o senza un vincolo di punteggio standard.

**Override manuale rally**: bottone sempre disponibile "punto A / punto B" che forza la
chiusura del rally corrente (`chiusuraManuale: true`), per i casi che l'euristica non
copre (invasioni, chiamate arbitrali, sequenze anomale).

**Annulla ultima azione**: rimuove l'ultima `Azione` in ordine assoluto nel set. Se era
quella che aveva determinato la chiusura automatica del rally, il rally torna aperto;
punteggio e rotazione si aggiornano da soli perché ricalcolati da zero ad ogni replay.
Nessuna logica di inversione da scrivere e mantenere.

## Flusso di scouting live

Layout landscape, iPad su supporto a bordo campo. Il fondamentale non è quasi mai un tap
esplicito: è dedotto dal contesto del rally, tranne nell'unico punto in cui il gioco
biforca davvero.

- **Battuta** (inizio di ogni rally): giocatore dedotto dalla rotazione (P1 della
  squadra al servizio) — nessun tap giocatore. Tap: **tipo battuta**
  (Flottante / Salto flottante / Salto spin) → valutazione → zona → direzione → salva.
  *(4 tap)*
- **Ricezione** (segue sempre una battuta, fondamentale implicito): tap giocatore (chi
  riceve, tra i 6 in campo) → valutazione → zona → salva. *(3 tap, nessuna direzione)*
- **Attacco** (segue sempre una ricezione la prima volta, fondamentale implicito): tap
  giocatore → valutazione → zona → direzione → salva. *(4 tap)*
- **Bivio esplicito dopo un attacco che non chiude il rally**: l'unico punto realmente
  ambiguo (l'avversario può murare, oppure la palla torna in gioco senza muro
  registrato). Tap esplicito **[Muro] [Attacco]** → giocatore → valutazione → zona →
  direzione → salva. *(5 tap incluso il bivio)*

Difesa e alzata **non sono fondamentali tracciati**: la loro presenza resta implicita
nella continuità del rally; l'informazione utile (qualità, direzione) la cattura già
l'attacco che segue.

Controlli sempre visibili sullo schermo principale: **Annulla ultima azione**,
**Sostituzione**, **Timeout**, **Chiudi set**, **Chiudi partita**, **Analisi live**.

Sostituzioni/timeout: modal rapido — scegli squadra, giocatore che esce (tra quelli in
campo), giocatore che entra (dalla panchina); salva `Sostituzione`/`Timeout` agganciato
al rally corrente.

## Statistiche e Analisi live

**Dashboard statistiche** (pannello richiamabile, non fisso sullo schermo principale):
per ogni fondamentale, per giocatore e per squadra: distribuzione valutazioni
(`#`/`+`/`!`/`-`/`=`) e **efficienza%** = `(# - =) / totale × 100`. Per la battuta,
breakdown aggiuntivo per `tipoBattuta`. Ricalcolo ad ogni azione da funzioni pure su
`domain/stats.ts`.

**Pannello "Analisi live"** (pulsante sempre raggiungibile, overlay che non fa perdere
lo stato del rally in corso — pensato per un'occhiata rapida da bordo campo):

- Classificazione automatica della direzione di ogni attacco confrontando la colonna di
  `zona` (origine: sinistra 4-5 / centro 3-6 / destra 2-1) con la colonna di
  `direzione` (destinazione: sinistra 7-4-5 / centro 8-3-6 / destra 9-2-1): stesso lato
  → **parallela**, lato opposto → **diagonale**, colonna centrale coinvolta → **centro**.
- **"Murato"**: esito derivato, non una zona — se nello stesso rally l'attacco è seguito
  da un'azione muro della squadra avversaria con valutazione `#`, quell'attacco è
  marcato "murato".
- Per ogni attaccante: % parallela / % diagonale / % centro, % murato, % errore
  diretto, e il **"colpo principale"** in evidenza (direzione più frequente).
- Badge di allerta colorato se errori+murati superano una soglia configurabile (default
  30%) — segnale rapido per valutare un cambio.
- Per i **centrali**: stessa vista ma con breakdown diretto sulle zone di destinazione
  6/5/1 (le tipiche del centrale) invece della classificazione diagonale/parallela.

## Storico

Lista partite salvate (Dexie `liveQuery`, reattiva), filtrabile per data/squadra. Tap su
una partita conclusa apre un report di sola lettura (box score + andamento set). Tap su
una partita `in_corso` la riapre nella schermata di scouting live esattamente dove era
rimasta.

## Export

- **CSV azioni** (v1, priorità): una riga per `Azione` — data, set, rally, squadra,
  giocatore, fondamentale, tipoBattuta, valutazione, zona, direzione, timestamp,
  punteggio risultante. Log grezzo, riusabile per sync video e analisi esterna.
- **CSV box score**: aggregato per giocatore/squadra/fondamentale con tentativi ed
  efficienza%.
- **PDF** (fase successiva): box score tabellare + grafico a barre per efficienza
  giocatore, generato client-side (jsPDF, grafico renderizzato su canvas e incorporato
  come immagine).

## PWA / offline

- `vite-plugin-pwa` in modalità `generateSW`: precache di tutti gli asset statici
  (JS/CSS/font), l'app funziona a freddo senza rete dopo la prima installazione.
- Manifest con icone iOS/iPadOS (`apple-touch-icon`), `display: standalone`,
  `orientation: landscape`.
- Nessuna gestione di sync dati in rete (tutto locale su Dexie): il service worker serve
  solo per l'app shell.
- Aggiornamenti: quando una nuova versione è pronta, il SW lo rileva al prossimo avvio
  online e mostra un prompt "Aggiornamento disponibile" invece di sostituire
  silenziosamente i file mentre una partita è in corso.

## Fuori scope per la v1 (non bloccare architetturalmente)

- Tagging video sincronizzato (il timestamp per-azione, soprattutto sulla battuta, resta
  come base per una sync manuale/futura)
- Account utente / sync cloud multi-dispositivo
- Modalità multi-utente in tempo reale (più scout sulla stessa partita)
- Validazione regole FIVB overlap/libero (rotazione semplificata, override manuale)
- Log/tracciamento delle chiamate di muro e calcolo automatico della loro efficacia
  (la valutazione tattica resta al coach; il sistema fornisce solo il colpo principale
  per attaccante)

## Funzionalità v1, in ordine di priorità

1. Gestione squadre e roster (CRUD giocatori, ruoli, numeri maglia)
2. Setup partita: squadre (anche due squadre terze in pre-scout), formazione titolare,
   rotazione iniziale, target punti set/set decisivo
3. Schermata di scouting live (tap-flow sopra) con punteggio/rotazione automatici,
   sostituzioni/timeout manuali, chiusura set/partita manuale o su conferma del banner
4. Annulla ultima azione
5. Dashboard statistiche live + pannello Analisi live
6. Storico set/partite
7. Export CSV (box score + log azioni); PDF con grafici come step successivo della
   stessa fase
