import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { creaSet, salvaLiberiSelezionati } from '@/db/matches';
import { giocatoreEleggibileLibero, servonoLiberiSelezionati } from '@/domain/liberi';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import type { Giro, Match, Player, Squadra } from '@/domain/types';

const ETICHETTA_GIRO: Record<Giro, string> = {
  'schiacciatore-centrale': 'Palleggiatore — Schiacciatore — Centrale',
  'centrale-schiacciatore': 'Palleggiatore — Centrale — Schiacciatore',
};

function SelettorePalleggiatoreGiro({
  titolareInOrdine,
  palleggiatoreId,
  onCambiaPalleggiatore,
  giro,
  onCambiaGiro,
}: {
  titolareInOrdine: Player[];
  palleggiatoreId: string | null;
  onCambiaPalleggiatore: (id: string | null) => void;
  giro: Giro;
  onCambiaGiro: (giro: Giro) => void;
}) {
  return (
    <div className="mt-3 rounded-lg bg-slate-900 p-3">
      <p className="mb-2 text-sm text-slate-400">
        Facoltativo: per il cambio automatico centrale↔libero in seconda linea.
      </p>
      <label className="mb-2 block text-sm">
        Palleggiatore
        <select
          value={palleggiatoreId ?? ''}
          onChange={(e) => onCambiaPalleggiatore(e.target.value || null)}
          className="mt-1 block w-full rounded-lg bg-slate-800 px-3 py-2"
        >
          <option value="">Nessuno (cambio automatico disattivo)</option>
          {titolareInOrdine.map((g) => (
            <option key={g.id} value={g.id}>
              #{g.numero} {g.nome}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Giro
        <select
          value={giro}
          onChange={(e) => onCambiaGiro(e.target.value as Giro)}
          className="mt-1 block w-full rounded-lg bg-slate-800 px-3 py-2"
        >
          {(Object.keys(ETICHETTA_GIRO) as Giro[]).map((g) => (
            <option key={g} value={g}>
              {ETICHETTA_GIRO[g]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function useRosterAttivo(teamId: string | undefined) {
  return useSupabaseQuery<Player[]>(
    async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('teamId', teamId)
        .eq('attivo', true)
        .order('numero');
      if (error) throw error;
      return data as Player[];
    },
    [teamId],
    ['players'],
  );
}

function SelettoreFormazione({
  giocatori,
  selezionati,
  onToggle,
}: {
  giocatori: Player[];
  selezionati: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {giocatori.map((g) => {
        const posizione = selezionati.indexOf(g.id);
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onToggle(g.id)}
              className={`w-full rounded-lg px-4 py-3 text-left text-lg ${posizione >= 0 ? 'bg-blue-700' : 'bg-slate-800'}`}
            >
              {posizione >= 0 ? `P${posizione + 1} — ` : ''}#{g.numero} {g.nome}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SelettoreLiberi({
  giocatori,
  selezionati,
  onToggle,
}: {
  giocatori: Player[];
  selezionati: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {giocatori.map((g) => {
        const scelto = selezionati.includes(g.id);
        return (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => onToggle(g.id)}
              className={`w-full rounded-lg px-4 py-3 text-left text-lg ${scelto ? 'bg-blue-700' : 'bg-slate-800'}`}
            >
              #{g.numero} {g.nome}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function LineupPicker() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const match = useSupabaseQuery<Match | null>(
    async () => {
      const { data, error } = await supabase.from('matches').select('*').eq('id', matchId!).maybeSingle();
      if (error) throw error;
      return data as Match | null;
    },
    [matchId],
    ['matches'],
  );
  const giocatoriA = useRosterAttivo(match?.squadraAId);
  const giocatoriB = useRosterAttivo(match?.squadraBId);
  const setsEsistenti = useSupabaseQuery<number>(
    async () => {
      if (!matchId) return 0;
      const { count, error } = await supabase
        .from('sets')
        .select('id', { count: 'exact', head: true })
        .eq('matchId', matchId);
      if (error) throw error;
      return count ?? 0;
    },
    [matchId],
    ['sets'],
  );

  const [formazioneA, setFormazioneA] = useState<string[]>([]);
  const [formazioneB, setFormazioneB] = useState<string[]>([]);
  const [primaSquadraAlServizio, setPrimaSquadraAlServizio] = useState<Squadra>('A');
  const [palleggiatoreIdA, setPalleggiatoreIdA] = useState<string | null>(null);
  const [palleggiatoreIdB, setPalleggiatoreIdB] = useState<string | null>(null);
  const [giroA, setGiroA] = useState<Giro>('schiacciatore-centrale');
  const [giroB, setGiroB] = useState<Giro>('schiacciatore-centrale');
  const [liberiScelA, setLiberiScelA] = useState<string[]>([]);
  const [liberiScelB, setLiberiScelB] = useState<string[]>([]);

  function toggle(formazione: string[], setFormazione: (v: string[]) => void, id: string) {
    if (formazione.includes(id)) setFormazione(formazione.filter((g) => g !== id));
    else if (formazione.length < 6) setFormazione([...formazione, id]);
  }

  function toggleLibero(scelti: string[], setScelti: (v: string[]) => void, id: string) {
    if (scelti.includes(id)) setScelti(scelti.filter((g) => g !== id));
    else if (scelti.length < 2) setScelti([...scelti, id]);
  }

  // liberiConfermati* tiene la scelta subito visibile in questa sessione
  // (aggiornamento ottimistico): il salvataggio su Supabase resta la fonte
  // di verita' per gli altri dispositivi/sessioni, ma non si aspetta il
  // giro di andata/ritorno della notifica realtime per sbloccare lo step
  // successivo in questa stessa schermata.
  const [liberiConfermatiA, setLiberiConfermatiA] = useState<string[] | null>(null);
  const [liberiConfermatiB, setLiberiConfermatiB] = useState<string[] | null>(null);
  const liberiEffettiviA = liberiConfermatiA ?? match?.liberiSelezionatiA ?? null;
  const liberiEffettiviB = liberiConfermatiB ?? match?.liberiSelezionatiB ?? null;

  const necessitaLiberoA = servonoLiberiSelezionati(giocatoriA ?? []) && liberiEffettiviA == null;
  const necessitaLiberoB = servonoLiberiSelezionati(giocatoriB ?? []) && liberiEffettiviB == null;
  const inAttesaSceltaLiberi = necessitaLiberoA || necessitaLiberoB;

  async function handleConfermaLiberi() {
    if (!match) return;
    const finaleA = necessitaLiberoA ? liberiScelA : liberiEffettiviA;
    const finaleB = necessitaLiberoB ? liberiScelB : liberiEffettiviB;
    if (necessitaLiberoA) setLiberiConfermatiA(finaleA);
    if (necessitaLiberoB) setLiberiConfermatiB(finaleB);
    await salvaLiberiSelezionati(match.id, finaleA, finaleB);
  }

  const giocatoriEleggibiliA = (giocatoriA ?? []).filter((g) => giocatoreEleggibileLibero(g, liberiEffettiviA));
  const giocatoriEleggibiliB = (giocatoriB ?? []).filter((g) => giocatoreEleggibileLibero(g, liberiEffettiviB));

  const inCampoOrdinataA = formazioneA
    .map((id) => giocatoriEleggibiliA.find((g) => g.id === id))
    .filter((g): g is Player => Boolean(g));
  const inCampoOrdinataB = formazioneB
    .map((id) => giocatoriEleggibiliB.find((g) => g.id === id))
    .filter((g): g is Player => Boolean(g));

  // Se il palleggiatore scelto viene poi tolto dalla formazione, la scelta
  // decade silenziosamente invece di essere salvata come riferimento a un
  // giocatore non piu' titolare in questo set.
  const palleggiatoreEffettivoA = formazioneA.includes(palleggiatoreIdA ?? '') ? palleggiatoreIdA : null;
  const palleggiatoreEffettivoB = formazioneB.includes(palleggiatoreIdB ?? '') ? palleggiatoreIdB : null;

  async function handleContinua() {
    if (!match || formazioneA.length !== 6 || formazioneB.length !== 6) return;
    const set = await creaSet({
      matchId: match.id,
      numero: (setsEsistenti ?? 0) + 1,
      formazioneInizialeA: formazioneA,
      formazioneInizialeB: formazioneB,
      primaSquadraAlServizio,
      paleggiatoreIdA: palleggiatoreEffettivoA,
      paleggiatoreIdB: palleggiatoreEffettivoB,
      giroA: palleggiatoreEffettivoA ? giroA : null,
      giroB: palleggiatoreEffettivoB ? giroB : null,
    });
    navigate(`/partite/${match.id}/scouting/${set.id}`);
  }

  if (inAttesaSceltaLiberi) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <Link to="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
          ← Home
        </Link>
        <h1 className="mb-2 text-2xl font-bold">Scegli i liberi (max 2)</h1>
        <p className="mb-4 text-slate-400">
          Una o entrambe le squadre hanno più di 2 liberi in rosa: scegli quali 2 giocano in questa partita. La
          scelta vale per tutta la partita, non serve ripeterla ad ogni set.
        </p>
        <div className="mb-6 grid grid-cols-2 gap-8">
          {necessitaLiberoA && (
            <div>
              <h2 className="mb-2 text-xl font-semibold">Squadra A ({liberiScelA.length}/2)</h2>
              <SelettoreLiberi
                giocatori={(giocatoriA ?? []).filter((g) => g.ruolo === 'libero')}
                selezionati={liberiScelA}
                onToggle={(id) => toggleLibero(liberiScelA, setLiberiScelA, id)}
              />
            </div>
          )}
          {necessitaLiberoB && (
            <div>
              <h2 className="mb-2 text-xl font-semibold">Squadra B ({liberiScelB.length}/2)</h2>
              <SelettoreLiberi
                giocatori={(giocatoriB ?? []).filter((g) => g.ruolo === 'libero')}
                selezionati={liberiScelB}
                onToggle={(id) => toggleLibero(liberiScelB, setLiberiScelB, id)}
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleConfermaLiberi}
          disabled={(necessitaLiberoA && liberiScelA.length !== 2) || (necessitaLiberoB && liberiScelB.length !== 2)}
          className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-40"
        >
          Conferma liberi
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <Link to="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Formazione titolare</h1>
      <p className="mb-4">Tocca i giocatori nellordine di rotazione P1...P6 (P1 al servizio).</p>
      <div className="mb-6 flex h-64 flex-col">
        <CampoDaGioco inCampoA={inCampoOrdinataA} inCampoB={inCampoOrdinataB} modalita={{ tipo: 'inattivo' }} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra A ({formazioneA.length}/6)</h2>
          <SelettoreFormazione
            giocatori={giocatoriEleggibiliA}
            selezionati={formazioneA}
            onToggle={(id) => toggle(formazioneA, setFormazioneA, id)}
          />
          {formazioneA.length === 6 && (
            <SelettorePalleggiatoreGiro
              titolareInOrdine={inCampoOrdinataA}
              palleggiatoreId={palleggiatoreEffettivoA}
              onCambiaPalleggiatore={setPalleggiatoreIdA}
              giro={giroA}
              onCambiaGiro={setGiroA}
            />
          )}
        </div>
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra B ({formazioneB.length}/6)</h2>
          <SelettoreFormazione
            giocatori={giocatoriEleggibiliB}
            selezionati={formazioneB}
            onToggle={(id) => toggle(formazioneB, setFormazioneB, id)}
          />
          {formazioneB.length === 6 && (
            <SelettorePalleggiatoreGiro
              titolareInOrdine={inCampoOrdinataB}
              palleggiatoreId={palleggiatoreEffettivoB}
              onCambiaPalleggiatore={setPalleggiatoreIdB}
              giro={giroB}
              onCambiaGiro={setGiroB}
            />
          )}
        </div>
      </div>
      <label className="mb-6 block text-lg">
        Al servizio per prima
        <select
          value={primaSquadraAlServizio}
          onChange={(e) => setPrimaSquadraAlServizio(e.target.value as Squadra)}
          className="mt-1 block w-48 rounded-lg bg-slate-800 px-4 py-3"
        >
          <option value="A">Squadra A</option>
          <option value="B">Squadra B</option>
        </select>
      </label>
      <button
        type="button"
        onClick={handleContinua}
        disabled={formazioneA.length !== 6 || formazioneB.length !== 6}
        className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-40"
      >
        Inizia partita
      </button>
    </main>
  );
}
