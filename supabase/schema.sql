-- Scouting Pallavolo: schema condiviso Supabase.
-- Esegui questo file una volta nel SQL Editor del progetto Supabase
-- (Dashboard -> SQL Editor -> New query -> incolla tutto -> Run).
--
-- I nomi delle colonne rispecchiano esattamente i campi di src/domain/types.ts
-- (camelCase, tra virgolette) per evitare un livello di mapping snake_case/
-- camelCase nel client. RLS e' attiva su tutte le tabelle: solo utenti
-- autenticati (i due account creati per i due dispositivi) possono leggere o
-- scrivere qualsiasi riga.

create table if not exists teams (
  id text primary key,
  nome text not null,
  "createdAt" timestamptz not null default now()
);

create table if not exists players (
  id text primary key,
  "teamId" text not null references teams(id) on delete cascade,
  numero int not null,
  nome text not null,
  ruolo text not null,
  attivo boolean not null default true
);
create index if not exists players_team_id_idx on players("teamId");

create table if not exists matches (
  id text primary key,
  data date not null,
  "squadraAId" text not null references teams(id),
  "squadraBId" text not null references teams(id),
  "squadraRiferimentoId" text references teams(id),
  "formatoSet" int not null,
  "puntiSet" int not null,
  "puntiSetDecisivo" int not null,
  stato text not null,
  note text,
  "liberiSelezionatiA" jsonb,
  "liberiSelezionatiB" jsonb
);
create index if not exists matches_stato_data_idx on matches(stato, data);

create table if not exists sets (
  id text primary key,
  "matchId" text not null references matches(id) on delete cascade,
  numero int not null,
  "formazioneInizialeA" jsonb not null,
  "formazioneInizialeB" jsonb not null,
  "primaSquadraAlServizio" text not null,
  stato text not null,
  vincitore text,
  "paleggiatoreIdA" text,
  "paleggiatoreIdB" text,
  "giroA" text,
  "giroB" text
);
create index if not exists sets_match_id_idx on sets("matchId");

create table if not exists rallies (
  id text primary key,
  "setId" text not null references sets(id) on delete cascade,
  numero int not null,
  "squadraAlServizio" text not null,
  esito text,
  "chiusuraManuale" boolean not null default false
);
create index if not exists rallies_set_id_numero_idx on rallies("setId", numero);

create table if not exists azioni (
  id text primary key,
  "rallyId" text not null references rallies(id) on delete cascade,
  "setId" text not null references sets(id) on delete cascade,
  ordine int not null,
  squadra text not null,
  "giocatoreId" text references players(id),
  fondamentale text not null,
  "tipoBattuta" text,
  valutazione text not null,
  origine jsonb,
  destinazione jsonb,
  "toccoMuro" boolean not null default false,
  "timestamp" timestamptz not null default now()
);
create index if not exists azioni_rally_id_ordine_idx on azioni("rallyId", ordine);
create index if not exists azioni_set_id_giocatore_id_idx on azioni("setId", "giocatoreId");

create table if not exists sostituzioni (
  id text primary key,
  "setId" text not null references sets(id) on delete cascade,
  "dopoRallyNumero" int not null,
  squadra text not null,
  "giocatoreEsceId" text not null references players(id),
  "giocatoreEntraId" text not null references players(id)
);
create index if not exists sostituzioni_set_id_idx on sostituzioni("setId");

create table if not exists timeouts (
  id text primary key,
  "setId" text not null references sets(id) on delete cascade,
  "dopoRallyNumero" int not null,
  squadra text not null
);
create index if not exists timeouts_set_id_idx on timeouts("setId");

alter table teams enable row level security;
alter table players enable row level security;
alter table matches enable row level security;
alter table sets enable row level security;
alter table rallies enable row level security;
alter table azioni enable row level security;
alter table sostituzioni enable row level security;
alter table timeouts enable row level security;

create policy "authenticated full access" on teams for all to authenticated using (true) with check (true);
create policy "authenticated full access" on players for all to authenticated using (true) with check (true);
create policy "authenticated full access" on matches for all to authenticated using (true) with check (true);
create policy "authenticated full access" on sets for all to authenticated using (true) with check (true);
create policy "authenticated full access" on rallies for all to authenticated using (true) with check (true);
create policy "authenticated full access" on azioni for all to authenticated using (true) with check (true);
create policy "authenticated full access" on sostituzioni for all to authenticated using (true) with check (true);
create policy "authenticated full access" on timeouts for all to authenticated using (true) with check (true);

-- Realtime: permette alle sottoscrizioni postgres_changes di ricevere gli
-- eventi INSERT/UPDATE/DELETE su queste tabelle (necessario per la
-- sincronizzazione live tra i due dispositivi).
alter publication supabase_realtime add table teams, players, matches, sets, rallies, azioni, sostituzioni, timeouts;
