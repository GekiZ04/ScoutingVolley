import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { caricaRiepilogoPartita, type RiepilogoPartita } from '@/db/matchSummary';
import { puntiVintiPerFonte } from '@/domain/tabellinoExtra';
import { normalizzaSet, normalizzaSostituzioni, normalizzaSuSquadra } from '@/domain/sommaPartite';
import type { DatiSetRotazioni } from '@/domain/rotazioni';
import type { Match, Team } from '@/domain/types';
import { BarraNavigazione } from '@/components/BarraNavigazione';
import { VistaRotazione } from '@/features/rotazioni/VistaRotazione';
import { TabellinoSquadra, type RigaTabellinoSquadra } from '@/features/tabellino/TabellinoSquadra';
import { valoriGiocatoreTabellino, valoriTotaleTabellino } from '@/features/tabellino/righeTabellino';

export function AnalisiIncontriPage() {
  const squadre = useSupabaseQuery<Team[]>(
    async () => {
      const { data, error } = await supabase.from('teams').select('*').order('nome');
      if (error) throw error;
      return data as Team[];
    },
    [],
    ['teams'],
  );
  const [teamId, setTeamId] = useState('');
  const [partite, setPartite] = useState<Match[]>([]);
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set());
  const [dati, setDati] = useState<Map<string, RiepilogoPartita>>(new Map());
  const [vista, setVista] = useState('tutte');
  const [rotazioni, setRotazioni] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const nomeSquadra = (id: string) => squadre?.find((s) => s.id === id)?.nome ?? id;

  useEffect(() => {
    setPartite([]);
    setSelezionate(new Set());
    setDati(new Map());
    setVista('tutte');
    setErrore(null);
    if (!teamId) return;
    let attivo = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('matches')
          .select('*')
          .order('data');
        if (error) throw error;
        const elenco = (data as Match[]).filter((m) => m.squadraAId === teamId || m.squadraBId === teamId);
        const riepiloghi = await Promise.all(elenco.map((m) => caricaRiepilogoPartita(m.id)));
        if (!attivo) return;
        setPartite(elenco);
        setSelezionate(new Set(elenco.map((m) => m.id)));
        setDati(new Map(riepiloghi.map((r) => [r.match.id, r])));
      } catch (e) {
        if (attivo) setErrore(e instanceof Error ? e.message : 'Errore nel caricamento delle partite');
      }
    })();
    return () => {
      attivo = false;
    };
  }, [teamId]);

  const etichetta = (m: Match) => `${m.data} ${nomeSquadra(m.squadraAId)} - ${nomeSquadra(m.squadraBId)}`;
  const usate = partite.filter((m) => selezionate.has(m.id) && (vista === 'tutte' || vista === m.id));

  const calcolato = useMemo(() => {
    if (!teamId || dati.size === 0) return null;
    const riepiloghi = usate.map((m) => dati.get(m.id)).filter((r): r is RiepilogoPartita => r !== undefined);
    const azioni = [] as RiepilogoPartita['tutteLeAzioni'];
    const rallies = [] as RiepilogoPartita['tutteLeRallies'];
    const setRotazione: DatiSetRotazioni[] = [];
    const liberi = new Set<string>();
    const roster = new Map<string, RiepilogoPartita['giocatori'][number]>();

    for (const r of riepiloghi) {
      const lato = r.match.squadraAId === teamId ? 'A' : 'B';
      const n = normalizzaSuSquadra(r.tutteLeAzioni, r.tutteLeRallies, lato);
      azioni.push(...n.azioni);
      rallies.push(...n.rallies);
      const sost = normalizzaSostituzioni(r.tutteLeSostituzioni, lato);
      for (const { set } of r.riepiloghi) {
        const nSet = normalizzaSuSquadra(
          r.tutteLeAzioni.filter((a) => a.setId === set.id),
          r.tutteLeRallies.filter((x) => x.setId === set.id),
          lato,
        );
        setRotazione.push({
          set: normalizzaSet(set, lato),
          rallies: nSet.rallies,
          azioni: nSet.azioni,
          sostituzioni: sost.filter((s) => s.setId === set.id),
        });
      }
      (lato === 'A' ? r.match.liberiSelezionatiA : r.match.liberiSelezionatiB)?.forEach((id) => liberi.add(id));
      r.giocatori.filter((g) => g.teamId === teamId).forEach((g) => roster.set(g.id, g));
    }

    const giocatori = [...roster.values()].sort((a, b) => a.numero - b.numero);
    const righe: RigaTabellinoSquadra[] = giocatori.map((g) => ({
      numero: g.numero,
      nome: g.nome,
      libero: g.ruolo === 'libero' || liberi.has(g.id),
      valori: valoriGiocatoreTabellino(azioni, rallies, g.id),
    }));
    return {
      righe,
      totale: valoriTotaleTabellino(azioni, rallies, 'A'),
      puntiVinti: [{ etichetta: 'Totale', valori: puntiVintiPerFonte(azioni, rallies, 'A') }],
      setRotazione,
      giocatori,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, dati, selezionate, vista, partite]);

  function alterna(id: string) {
    setSelezionate((prima) => {
      const dopo = new Set(prima);
      if (dopo.has(id)) {
        dopo.delete(id);
        setVista((v) => (v === id ? 'tutte' : v));
      } else dopo.add(id);
      return dopo;
    });
  }

  const bottone = 'rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600';

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <BarraNavigazione />
      <h1 className="mb-4 text-2xl font-bold">Analisi incontri</h1>
      <label className="mb-4 flex items-center gap-2 text-sm font-semibold">
        Squadra
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          className="rounded-lg bg-slate-800 px-3 py-2 text-base font-normal"
        >
          <option value="">Scegli una squadra</option>
          {(squadre ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.nome}
            </option>
          ))}
        </select>
      </label>
      {errore && (
        <div role="alert" className="mb-4 rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold">
          {errore}
        </div>
      )}
      {partite.length > 0 && (
        <ul className="mb-4 space-y-1">
          {partite.map((m) => (
            <li key={m.id}>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={selezionate.has(m.id)} onChange={() => alterna(m.id)} />
                {etichetta(m)}
              </label>
            </li>
          ))}
        </ul>
      )}
      {calcolato && (
        <>
          <div className="mb-4 flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Vista
              <select
                value={vista}
                onChange={(e) => setVista(e.target.value)}
                className="rounded-lg bg-slate-800 px-3 py-2 text-base font-normal"
              >
                <option value="tutte">Tutte</option>
                {partite
                  .filter((m) => selezionate.has(m.id))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {etichetta(m)}
                    </option>
                  ))}
              </select>
            </label>
            <button type="button" className={bottone} onClick={() => setRotazioni(true)}>
              Rotazioni
            </button>
          </div>
          <div className="bg-white p-4 text-black" data-testid="tabellino-squadra">
            <TabellinoSquadra
              nomeSquadra={nomeSquadra(teamId)}
              righe={calcolato.righe}
              totale={calcolato.totale}
              puntiVinti={calcolato.puntiVinti}
            />
          </div>
          {rotazioni && (
            <VistaRotazione
              squadra="A"
              nomeSquadra={nomeSquadra(teamId)}
              giocatori={calcolato.giocatori}
              dati={calcolato.setRotazione}
              zonaIniziale={1}
              onChiudi={() => setRotazioni(false)}
            />
          )}
        </>
      )}
    </main>
  );
}
