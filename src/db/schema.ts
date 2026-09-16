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
