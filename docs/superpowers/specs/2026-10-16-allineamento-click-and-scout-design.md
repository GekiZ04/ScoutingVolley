# Design: allineamento a Click&Scout

Data: 2026-10-16. Fonte: sessione dal vivo su Click&Scout 1.0.49 (Data Project,
iPad) duplicato su PC, confrontata con il codice attuale.

## Perché

L'utente fa scouting dal vivo e conosce Click&Scout. Vuole che il nostro
programma funzioni allo stesso modo nelle parti che usa davvero: vedere a ogni
tocco il codice registrato (così Annulla è prevedibile), avere la formazione e
il tabellino come li conosce, e poter rivedere gli attacchi per rotazione.
Molte basi ci sono già (valutazioni di default, colori delle traiettorie,
`giro` + palleggiatore per set, tabellino diviso per set nell'export,
"ultimo gesto" in `domain/annulla.ts`): questo lavoro le completa e le rende
visibili.

## Obiettivi (decisi dall'utente)

1. **Striscia dei codici DataVolley** in basso nello scout, con Annulla che si
   comporta come in Click&Scout.
2. **Replay** (palla da rigiocare).
3. **Direzioni di battuta del battitore** mostrate in automatico dal vivo.
4. **Attacchi per rotazione** (colonna P1–P6).
5. **Formazione su griglia** con ruoli ricavati da palleggiatore + sistema e
   tasto Ruota.
6. **Tabellino unico consultabile nell'app**, con le nostre colonne e la
   grafica di Click&Scout, e menu a tendina Tutti / Set N.
7. **Archivio partite** come tabella, con scheda partita.
8. **Analisi Incontri**: somma dei dati di più partite della stessa squadra.

## Non obiettivi

- Tipo di attacco (S/Q/T) e numero di giocatori a muro (0/1/2): non servono.
- Timeout e sostituzioni: restano come sono, funzionano già bene.
- Dati partita aggiuntivi (campionato, giornata, arbitri, palazzetto,
  scoutman, spettatori, incasso, ora fine) e allenatore/assistente: non servono.
- Le altre analisi di Click&Scout (Statistiche, Direzioni Squadra/Giocatori,
  Ricezione Squadra, Distribuzione…): tutto va nel tabellino unico, tranne la
  vista per rotazione (punto 4).
- Interpretazione della valutazione in base al punto finale dopo il muro:
  Click&Scout lo fa e produce risultati strani (`/` + punto finale nel campo di
  chi mura diventa errore d'attacco + errore di muro). Noi no.

## Anti-obiettivi

- Annulla che toglie qualcosa di diverso dal codice evidenziato accanto al
  tasto.
- Più tocchi per uno scambio tipico rispetto a oggi.
- Codici mostrati che non corrispondono ai dati salvati (i codici si
  ricavano dai dati, non si salvano a parte).

## 1. Striscia codici + Annulla

### Comportamento osservato in Click&Scout

- Barra in basso: codici in ordine cronologico, colorati per squadra; l'ultimo
  è grande ed evidenziato, attaccato al tasto UNDO; frecce « » ai lati per
  scorrere i più vecchi.
- Esempi reali: `a15SQ-` (battuta), `*98RQ+` (ricezione, eredita il tipo della
  battuta), `*46AU#` (attacco), `*$$BU#` (muro con giocatore sconosciuto),
  `*43BU#` (muro attribuito), `*p01:00` (punto, punteggio dopo il punto),
  `**4Set` (fine set). Prima del primo scambio compaiono anche `Line Up` e
  `aSERVE`/`*SERVE`.
- UNDO toglie in un colpo l'**ultimo gesto dell'utente**, compresi i codici
  generati in automatico (es. il muro) e i tocchi di traiettoria. Su un
  attacco murato servono due UNDO: il primo toglie valutazione + muro, il
  secondo tutto l'attacco (giocatore, partenza, MURO, arrivo).

### Cosa facciamo

- Nuovo modulo di dominio `codiciDataVolley` che, dati set/rally/azioni/
  sostituzioni/punteggio, produce la lista dei codici della partita in ordine.
  I codici **non si salvano**: si ricalcolano a ogni render, quindi dopo un
  Annulla o una correzione sono sempre coerenti.
- Formato (da allineare a DataVolley come visto sopra):
  - squadra: `*` per la squadra A (casa), `a` per la squadra B;
  - giocatore a due cifre (`07`, `15`); `$$` se `giocatoreId` è null;
  - fondamentale: `S` battuta, `R` ricezione, `A` attacco, `B` muro;
  - tipo: per battuta e ricezione da `tipoBattuta` (`salto_spin`→`Q`,
    `salto_flottante`→`M`, `flottante`→`H`, mapping DataVolley); per
    attacco e muro una lettera fissa (**scelta mia: `H`**, visto che il tipo
    d'attacco non si rileva);
  - valutazione: il simbolo `# + ! - / =`;
  - punto: `*pAA:BB` o `apAA:BB` (chi ha fatto punto, punteggio dopo);
  - fine set: `**NSet`.
- Striscia `StrisciaCodici` al posto di `StrisciaUltimaAzione`: colori per
  squadra (A e B come nel resto dell'app), ultimo codice evidenziato attaccato
  al tasto Annulla, scorrimento con « ». La correzione della valutazione
  dell'ultima azione resta (oggi con i bottoni di `StrisciaUltimaAzione`):
  come presentarla nella nuova striscia è lasciato al builder, purché resti a
  un tocco.
- Annulla: si tiene la logica di `trovaUltimoAnnullabile` / "ultimo gesto"
  (azioni con lo stesso timestamp, più `indietro()` dei flussi per i tocchi
  non ancora salvati). Requisito: **ciò che Annulla toglie è sempre l'ultimo
  codice evidenziato** (o il gruppo di codici dello stesso gesto). Se oggi ci
  sono casi in cui non coincide, si allinea la logica, non la striscia.

## 2. Flusso di scout

Già presenti e da non toccare: valutazioni di default (battuta `-` salvo
ace/errore, ricezione derivata, attacco `+`), colori traiettorie (nero =
punto, verde = palla rigiocata, rosso = errore/murato), muro sempre appaiato
all'attacco con valutazione derivata, alzata e difesa non registrate.

Da verificare e completare:

- **Punto manuale promuove l'ultimo attacco** (`*46AU+` → `*46AU#`): c'è già
  in `liveMatchStore.chiudiRallyManuale`. Nella striscia deve vedersi come in
  Click&Scout: l'attacco cambia in `#` e segue il codice punto; un Annulla
  toglie la promozione e riapre il rally (comportamento già esistente).
- **Muro**: `/` sull'attacco = muro `#` dell'altra squadra; si sceglie il
  murante tra i **soli giocatori in prima linea** della squadra che mura,
  oppure si salta (giocatore `$$`). Oggi il murante è chiesto durante
  l'attacco: va bene tenerlo dov'è, basta che la scelta sia limitata alla
  prima linea e saltabile.
- **Er.Avv** genera solo il punto, nessun codice d'errore di giocatore (come
  già facciamo con la chiusura manuale).

### Replay (palla da rigiocare)

Tasto "Replay" nella barra dello scout. Chiede conferma ("L'intero scambio
verrà eliminato, continuare?"). Se sì, elimina tutte le azioni del rally
aperto senza assegnare punti; servizio e rotazione non cambiano. Se il rally
aperto non ha azioni, il tasto non fa nulla (o è disattivato). Annullabile?
**Scelta mia: no**, la conferma basta.

### Direzioni di battuta del battitore

Quando una squadra è al servizio e il battitore è noto, sul campo compaiono in
automatico (senza tasto) le frecce di **tutte le sue battute della partita**,
set precedenti compresi, con i colori d'esito già usati per le battute. Spariscono
appena parte la battuta registrata. Un interruttore per nasconderle è lasciato
al builder (Click&Scout ha "Mostra/Nascondi Dir Battute").

## 3. Attacchi per rotazione (colonna P1–P6)

Osservato: a destra dello scout una colonna P1…P6 con la rotazione corrente
evidenziata. Toccando una casella si apre una vista "‹Squadra› – P1" con:

- il campo con le frecce degli attacchi della squadra fatti **mentre era in
  quella rotazione** (numero di rotazione = zona del palleggiatore), nei
  colori d'esito (nero punto, verde palla rigiocata, rosso errore/murato);
- filtri: **Att dopo Ric** (default), **Att dopo Ric Pos**, **Contrattacco**;
- i giocatori disegnati nelle posizioni dell'ultima azione filtrata;
- "Finito" per tornare allo scout; le altre caselle per cambiare rotazione.

Per noi: la colonna e la vista vanno nello scout e nell'analisi della partita.
Squadra mostrata: la squadra di riferimento se c'è, altrimenti un selettore
A/B (**scelta mia**). Le classificazioni "dopo ricezione", "dopo ricezione
positiva" e "contrattacco" esistono già per il tabellino
(`statisticheComplete`): vanno riusate. La rotazione si ricava da
`paleggiatoreId` + formazione iniziale + rotazioni del set; se il
palleggiatore non è indicato per quella squadra, la colonna non si mostra.

## 4. Formazione

Osservato in Click&Scout:

- le due squadre affiancate; per ognuna la rosa come bolle numerate (la "P"
  segna i palleggiatori) e un campo 2×3 con la rete in alto (righe 4-3-2 /
  5-6-1); si tocca un numero e va nella prossima casella libera,
  evidenziata in giallo (si parte dalla posizione 1); i giocatori messi in
  campo spariscono dalla panchina;
- sotto ogni campo: **Reset**, **Ruota** e, quando le 6 caselle sono piene, i
  tasti **P-S-C** / **P-C-S**; un tasto al centro per invertire i lati;
- i ruoli (P, S, C, O) compaiono come lettere nelle caselle, ricavati dalla
  posizione del palleggiatore e dal sistema;
- i liberi L1/L2 precompilati sotto.

Per noi: rifare `LineupPicker` così. Il dato salvato resta quello di oggi
(`formazioneIniziale*`, `paleggiatoreId*`, `giro*`, liberi): il palleggiatore è
il giocatore marcato P nella griglia (o scelto toccando la casella, a scelta
del builder), P-S-C = `schiacciatore-centrale`, P-C-S =
`centrale-schiacciatore`. Il tasto **Ruota** è il "gira formazione" che c'è
già e va tenuto: l'utente ci tiene esplicitamente. I ruoli da anagrafica non
servono più per la formazione (restano per il libero).

## 5. Tabellino unico nell'app

Una pagina tabellino raggiungibile **durante lo scout** (tasto Analisi) e
**dalla scheda partita** in archivio, con menu a tendina in alto **Tutti /
Set 1 / Set 2 …** che filtra tutti i numeri; in alto anche i comandi di
export che già abbiamo (PDF, Excel, CSV) e stampa.

Colonne: **le nostre** (`GRUPPI_TABELLINO`: battuta, direzioni battuta,
ricezione, attacco, attacco dopo ricezione pos/neg, contrattacco, muro,
direzioni attacco) **più** quelle che mancano rispetto a Click&Scout:

- **Punti: Tot, BP (break point), V‑P (vinti meno persi)**. Tot = punti
  diretti del giocatore (battuta `#`, attacco `#`, muro `#`); BP = di questi,
  quelli fatti con la propria squadra al servizio; V‑P = punti fatti meno
  punti persi dal giocatore (errori e murati che chiudono il rally).
- **Colonne Set 1–5 con la posizione di partenza** (1–6 nel quadratino, in
  grassetto per il palleggiatore iniziale; rettangolo vuoto se entrato dalla
  panchina o se libero; L accanto al nome dei liberi) e **cerchio sul numero
  del set** in cui quella squadra ha battuto per prima.
- **Riga "Punti Vinti" per set** sotto il totale squadra: Batt / Att / Mur /
  Er.Av. (Er.Av. = punti ottenuti da errori avversari, inclusi i punti
  manuali senza azione).

Grafica: come il referto Click&Scout (bianco, bordi neri, intestazioni di
gruppo su due righe, legenda in fondo). Intestazione: squadre e risultato in
set; data; tabella set con **Durata** (dal primo all'ultimo timestamp delle
azioni del set, in h.mm), **Punteggi Parziali** al primo raggiungimento di
8, 16 e 21 punti da parte di una delle due squadre, e **Finali**; totali in
fondo. Legenda come Click&Scout (BP, Pt, Err, Mur, Pos%, Prf, V‑P, simboli
di palleggiatore iniziale / formazione iniziale / entrato / prima battuta).

Il tabellino PDF ed Excel esistenti devono mostrare le stesse colonne nuove
(stessa fonte dati, `tabellinoColonne.ts`).

## 6. Archivio partite

`HistoryListPage` diventa una tabella come l'"Archivio Incontri" di
Click&Scout: data e ora, squadra A, **risultato in set**, squadra B, note
(il nostro campo `note`, al posto dell'etichetta campionato), ultima
modifica (**se non abbiamo il dato, si omette: scelta mia**). In alto
"Nuova partita". Toccando una riga si apre la **scheda partita**:

- data, squadre, risultato in set e sotto i parziali dei set (`18-25 | 18-25
  | 25-22 | 14-25`);
- quattro azioni: **Analisi** (tabellino unico + vista per rotazione),
  **Elimina** (con conferma), **Esporta** (i nostri export), **Rilevazione**
  (riapre lo scout dove si era fermato; per una partita conclusa, Click&Scout
  mostra "Partita Finita" con "Continua Rilevazione").

L'attuale `MatchReportPage` viene sostituita dalla scheda + tabellino; il box
score e l'elenco cambi/timeout sono assorbiti dal tabellino o restano sotto
"Analisi", a scelta del builder purché nulla vada perso.

## 7. Analisi Incontri (più partite della stessa squadra)

In Click&Scout "Analisi Incontri" permette di sommare i dati di più partite
della stessa squadra. Per noi: una pagina "Analisi incontri" raggiungibile
dalla home, dove si sceglie **una squadra** e poi **le partite** da sommare
tra quelle in cui ha giocato (tutte selezionate di default, con possibilità di
toglierne; **scelta mia**). Il risultato è:

- il **tabellino unico** (stessa grafica e colonne della parte 5) con il
  **solo blocco di quella squadra**, numeri sommati su tutte le partite
  scelte; il menu a tendina in alto diventa **Tutte / singola partita**
  invece di Tutti / Set N (**scelta mia**); le colonne Set 1–5 con le
  posizioni di partenza e la tabella durate/parziali non hanno senso sulla
  somma e si omettono (**scelta mia**);
- la **vista per rotazione** (parte 3) sulla somma delle partite scelte.

I giocatori si riconoscono per `giocatoreId` (stessa rosa), quindi la somma è
naturale; le percentuali si ricalcolano sui totali, non si fa la media delle
percentuali delle singole partite.

## Vincoli

- Stack esistente: React 18, Zustand, Tailwind, Supabase, Vitest + Testing
  Library; niente nuove dipendenze se non serve.
- Uso su tablet, dal vivo: tocchi grandi, nessun passo in più nello scambio.
- I testi dell'interfaccia sono in italiano.
- Test con TDD come nel resto del repo; i flussi di scout hanno già test
  estesi (`LiveScoutingScreen.test.tsx`, `flussiIndietro.test.tsx`) che
  devono restare verdi o essere aggiornati in modo esplicito.

## Lasciato al builder

- Ordine di implementazione (consigliato: 1 → 2 → 4 → 5 → 3 → 6 → 7).
- Struttura dei componenti e dei moduli di dominio.
- Dettagli grafici entro i riferimenti sopra.

## Riferimenti

- Memoria del progetto: osservazioni dettagliate di Click&Scout.
- Spec precedente: `2026-09-22-valutazione-automatica-clickscout-design.md`
  (valutazioni di default, colori, striscia ultima azione).
