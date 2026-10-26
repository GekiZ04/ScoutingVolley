import { supabase } from '@/lib/supabase';
import { caricaRiepilogoPartita, type RiepilogoPartita } from '@/db/matchSummary';
import { cronologiaSet } from '@/domain/cronologiaSet';
import { codiceScout, due, prefissoSquadra } from '@/domain/dvw';
import { cellaSetGiocatore, durataSet, parzialiSet } from '@/domain/tabellinoExtra';
import type { Azione, Player, Ruolo, Squadra, Team } from '@/domain/types';

// File in stile DataVolley (.dvw): stesse sezioni del formato e scout con i
// codici dell'app. Combinazioni d'attacco, chiamate e video non sono rilevati
// e restano vuoti.

const A_CAPO = '\r\n';
const RUOLO: Record<Ruolo, number> = { libero: 1, schiacciatore: 2, opposto: 3, centrale: 4, palleggiatore: 5 };

const oraDi = (timestamp: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(new Date(timestamp))
    .replace(/:/g, '.');

function dataItaliana(iso: string): string {
  const [anno, mese, giorno] = iso.split('-');
  return `${giorno}/${mese}/${anno}`;
}

function sigla(nome: string): string {
  return nome.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 3).toUpperCase() || 'SQ';
}

export function testoDvw(dati: RiepilogoPartita, nomi: Record<Squadra, string>, adesso = new Date()): string {
  const { match, giocatori, riepiloghi } = dati;
  const righe: string[] = [];
  const numero = new Map(giocatori.map((g) => [g.id, g.numero]));
  const numeroDi = (id: string | null) => (id === null ? null : numero.get(id) ?? null);
  const delSet = <T extends { setId: string }>(lista: T[], setId: string) => lista.filter((x) => x.setId === setId);

  const generato = `${adesso.getFullYear()}/${due(adesso.getMonth() + 1)}/${due(adesso.getDate())} ${oraDi(adesso.toISOString())}`;
  righe.push(
    '[3DATAVOLLEYSCOUT]',
    'FILEFORMAT: 2.0',
    `GENERATOR-DAY: ${generato}`,
    'GENERATOR-IDP: ScoutingVolley',
    'GENERATOR-PRG: ScoutingVolley',
    '[3MATCH]',
    `${dataItaliana(match.data)};;;;;;;;;;Z;0;`,
  );

  const vinti = (s: Squadra) => riepiloghi.filter((r) => r.set.vincitore === s).length;
  righe.push('[3TEAMS]', `${sigla(nomi.A)};${nomi.A};${vinti('A')};;;`, `${sigla(nomi.B)};${nomi.B};${vinti('B')};;;`);
  righe.push('[3MORE]', ';;;;;;', '[3COMMENTS]', ';;;;;');

  righe.push('[3SET]');
  for (let i = 0; i < 5; i += 1) {
    const r = riepiloghi[i];
    if (!r) {
      righe.push('False;;;;;;');
      continue;
    }
    const cronologia = cronologiaSet(r.set, delSet(dati.tutteLeRallies, r.set.id), delSet(dati.tutteLeAzioni, r.set.id), delSet(dati.tutteLeSostituzioni, r.set.id), delSet(dati.tutteLeCorrezioni, r.set.id));
    const parziali = parzialiSet(cronologia).map((p) => p ?? '');
    righe.push(`True;${parziali.join(';')};${r.punteggioA}-${r.punteggioB};${durataSet(delSet(dati.tutteLeAzioni, r.set.id))};`);
  }

  // Giocatori di ogni lato. DataVolley li riconosce dal numero: se in rosa ci
  // sono due schede con lo stesso numero (giocatore ricreato) diventano una
  // riga sola, con le posizioni di entrambe e i due nomi.
  (['A', 'B'] as const).forEach((lato, squadraIndice) => {
    righe.push(lato === 'A' ? '[3PLAYERS-H]' : '[3PLAYERS-V]');
    const teamId = lato === 'A' ? match.squadraAId : match.squadraBId;
    const perNumero = new Map<number, Player[]>();
    for (const g of giocatori.filter((x) => x.teamId === teamId)) perNumero.set(g.numero, [...(perNumero.get(g.numero) ?? []), g]);
    const posizione = (g: Player, s: number): string => {
      const r = riepiloghi[s];
      if (!r) return '';
      const cella = cellaSetGiocatore({
        set: r.set,
        sostituzioni: delSet(dati.tutteLeSostituzioni, r.set.id).filter((x) => x.squadra === lato),
        azioni: delSet(dati.tutteLeAzioni, r.set.id).filter((a) => a.squadra === lato),
        giocatore: g,
      });
      if (!cella) return '';
      return cella.tipo === 'titolare' ? String(cella.posizione) : '*';
    };
    [...perNumero.entries()]
      .sort(([x], [y]) => x - y)
      .forEach(([n, schede], i) => {
        const posizioni = [0, 1, 2, 3, 4].map((s) => {
          const celle = schede.map((g) => posizione(g, s));
          return celle.find((c) => c !== '' && c !== '*') ?? celle.find((c) => c === '*') ?? '';
        });
        const inCampo = schede.find((g) => [0, 1, 2, 3, 4].some((s) => posizione(g, s) !== '')) ?? schede[0];
        const nomiScheda = [...new Set(schede.map((g) => g.nome))].join(' / ');
        righe.push(`${squadraIndice};${n};${i + 1};${posizioni.join(';')};${sigla(nomi[lato])}-${due(n)};${nomiScheda};;;;;${RUOLO[inCampo.ruolo]};False;;`);
      });
  });

  righe.push(
    '[3ATTACKCOMBINATION]',
    '[3SETTERCALL]',
    '[3WINNINGSYMBOLS]',
    '=~~~#~~~=~~~~~~~=/~~#~~~=~~~~~~~=~~~~~~~=~~~~~~~=/~~~~~~~=~~~~~~~',
    '[3RESERVE]',
    '[3VIDEO]',
    '[3SCOUT]',
  );

  for (const { set } of riepiloghi) {
    const rallies = delSet(dati.tutteLeRallies, set.id);
    const azioni = delSet(dati.tutteLeAzioni, set.id);
    const sostituzioni = delSet(dati.tutteLeSostituzioni, set.id);
    const timeouts = delSet(dati.tutteITimeout, set.id);
    const cronologia = cronologiaSet(set, rallies, azioni, sostituzioni, delSet(dati.tutteLeCorrezioni, set.id));

    const zonaPalleggiatore = (rotazione: string[], id: string | null) => {
      const i = id ? rotazione.indexOf(id) : -1;
      return i >= 0 ? String(i + 1) : '';
    };
    const riga = (codice: string, ora: string, rotA: string[], rotB: string[]) => {
      const numeri = (rot: string[]) => rot.map((id) => numeroDi(id) ?? '').join(';');
      return `${codice};;;;;;;${ora};${set.numero};${zonaPalleggiatore(rotA, set.paleggiatoreIdA)};${zonaPalleggiatore(rotB, set.paleggiatoreIdB)};1;;;${numeri(rotA)};${numeri(rotB)};`;
    };

    // Formazione di partenza: palleggiatore e sua zona per chi l'ha indicato.
    const rotA0 = set.formazioneInizialeA;
    const rotB0 = set.formazioneInizialeB;
    for (const [lato, id, rot] of [['A', set.paleggiatoreIdA, rotA0], ['B', set.paleggiatoreIdB, rotB0]] as const) {
      const n = numeroDi(id);
      if (n === null) continue;
      righe.push(riga(`${prefissoSquadra(lato)}P${due(n)}>LUp`, '', rotA0, rotB0));
      righe.push(riga(`${prefissoSquadra(lato)}z${zonaPalleggiatore(rot, id)}>LUp`, '', rotA0, rotB0));
    }

    const eventiDopo = (numeroRally: number, rotA: string[], rotB: string[]) => {
      for (const s of sostituzioni.filter((x) => x.dopoRallyNumero === numeroRally)) {
        righe.push(riga(`${prefissoSquadra(s.squadra)}c${due(numeroDi(s.giocatoreEsceId) ?? 0)}:${due(numeroDi(s.giocatoreEntraId) ?? 0)}`, '', rotA, rotB));
      }
      for (const t of timeouts.filter((x) => x.dopoRallyNumero === numeroRally)) {
        righe.push(riga(`${prefissoSquadra(t.squadra)}T`, '', rotA, rotB));
      }
    };

    eventiDopo(0, rotA0, rotB0);
    for (const r of cronologia) {
      const delRally = azioni.filter((a) => a.rallyId === r.rallyId).sort((x, y) => x.ordine - y.ordine);
      const battuta: Azione | null = delRally.find((a) => a.fondamentale === 'battuta') ?? null;
      for (const a of delRally) {
        righe.push(riga(codiceScout(a, numeroDi(a.giocatoreId), battuta), oraDi(a.timestamp), r.rotazioneA, r.rotazioneB));
      }
      if (r.vincitore) {
        const ultima = delRally[delRally.length - 1];
        righe.push(riga(`${prefissoSquadra(r.vincitore)}p${due(r.punteggioA)}:${due(r.punteggioB)}`, ultima ? oraDi(ultima.timestamp) : '', r.rotazioneA, r.rotazioneB));
      }
      const dopo = cronologia[cronologia.indexOf(r) + 1];
      eventiDopo(r.numero, dopo?.rotazioneA ?? r.rotazioneA, dopo?.rotazioneB ?? r.rotazioneB);
    }
    righe.push(`**${set.numero}set`);
  }

  return righe.join(A_CAPO) + A_CAPO;
}

export async function generaDvw(matchId: string): Promise<string> {
  const dati = await caricaRiepilogoPartita(matchId);
  const { data } = await supabase.from('teams').select('*').in('id', [dati.match.squadraAId, dati.match.squadraBId]);
  const squadre = (data ?? []) as Team[];
  const nome = (id: string, ripiego: string) => squadre.find((t) => t.id === id)?.nome ?? ripiego;
  return testoDvw(dati, { A: nome(dati.match.squadraAId, 'Squadra A'), B: nome(dati.match.squadraBId, 'Squadra B') });
}

export function scaricaDvw(nomeFile: string, contenuto: string): void {
  const blob = new Blob(['﻿' + contenuto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
