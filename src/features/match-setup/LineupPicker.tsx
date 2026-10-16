import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { avviaSet, salvaLiberiSelezionati } from '@/db/matches';
import { giocatoreEleggibileLibero, servonoLiberiSelezionati } from '@/domain/liberi';
import { ruotaFormazione } from '@/domain/rotation';
import { ruoloInSlot } from '@/domain/ruoliDaSistema';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import type { Giro, Match, Player, Squadra } from '@/domain/types';
import { BarraNavigazione } from '@/components/BarraNavigazione';

const ZONE_RIGA_ALTA = [4, 3, 2];
const ZONE_RIGA_BASSA = [5, 6, 1];

// Palleggiatore effettivo: la scelta esplicita se e' ancora titolare, altrimenti
// il primo titolare (in ordine di zona) con ruolo anagrafica palleggiatore.
function palleggiatoreEffettivo(formazione: string[], titolabili: Player[], scelto: string | null): string | null {
  if (scelto && formazione.includes(scelto)) return scelto;
  return formazione.find((id) => titolabili.find((g) => g.id === id)?.ruolo === 'palleggiatore') ?? null;
}

function FormazioneGriglia({
  sigla,
  titolabili,
  formazione,
  onCambiaFormazione,
  palleggiatoreId,
  onCambiaPalleggiatore,
  giro,
  onCambiaGiro,
}: {
  sigla: 'a' | 'b';
  titolabili: Player[];
  formazione: string[];
  onCambiaFormazione: (v: string[]) => void;
  palleggiatoreId: string | null;
  onCambiaPalleggiatore: (id: string | null) => void;
  giro: Giro;
  onCambiaGiro: (giro: Giro) => void;
}) {
  const rosa = titolabili.filter((g) => !formazione.includes(g.id));
  const piena = formazione.length === 6;
  const indicePalleggiatore = palleggiatoreId ? formazione.indexOf(palleggiatoreId) : -1;

  function cella(zona: number) {
    const indice = zona - 1;
    const id = formazione[indice];
    const giocatore = id ? titolabili.find((g) => g.id === id) : undefined;
    const prossima = !giocatore && indice === formazione.length;
    const eP = giocatore && id === palleggiatoreId;
    return (
      <button
        key={zona}
        type="button"
        data-testid={`cella-${sigla}-${zona}`}
        onClick={() => {
          if (giocatore) onCambiaPalleggiatore(giocatore.id);
        }}
        className={`flex h-20 flex-col items-center justify-center rounded-lg border-2 px-1 text-center ${
          prossima
            ? 'border-yellow-400 bg-yellow-400/20'
            : eP
              ? 'border-blue-400 bg-blue-700'
              : giocatore
                ? 'border-slate-600 bg-slate-800'
                : 'border-slate-700 bg-slate-900'
        }`}
      >
        <span className="text-xs text-slate-400">Zona {zona}</span>
        {giocatore && (
          <span className="text-sm font-semibold">
            #{giocatore.numero} {giocatore.nome}
          </span>
        )}
        {giocatore && piena && indicePalleggiatore >= 0 && (
          <span data-testid={`ruolo-${sigla}-${zona}`} className="text-xs font-bold text-yellow-300">
            {ruoloInSlot(indice, indicePalleggiatore, giro)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-2">
        {rosa.map((g) => (
          <li key={g.id}>
            <button
              type="button"
              onClick={() => {
                if (!piena) onCambiaFormazione([...formazione, g.id]);
              }}
              className="flex items-center gap-1 rounded-full bg-slate-800 px-3 py-2"
            >
              <span>
                #{g.numero} {g.nome}
              </span>
              {g.ruolo === 'palleggiatore' && (
                <span className="rounded-full bg-blue-700 px-1.5 text-xs font-bold">P</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="mb-1 border-b-4 border-slate-300 text-center text-xs text-slate-400">Rete</div>
      <div className="grid grid-cols-3 gap-2">
        {ZONE_RIGA_ALTA.map(cella)}
        {ZONE_RIGA_BASSA.map(cella)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-testid={`reset-${sigla}`}
          onClick={() => {
            onCambiaFormazione([]);
            onCambiaPalleggiatore(null);
          }}
          className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold"
        >
          Reset
        </button>
        {piena && (
          <button
            type="button"
            data-testid={`ruota-${sigla}`}
            onClick={() => onCambiaFormazione(ruotaFormazione(formazione, 1))}
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold"
          >
            Ruota
          </button>
        )}
        {piena &&
          (['schiacciatore-centrale', 'centrale-schiacciatore'] as Giro[]).map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={giro === g}
              onClick={() => onCambiaGiro(g)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${giro === g ? 'bg-blue-700' : 'bg-slate-800'}`}
            >
              {g === 'schiacciatore-centrale' ? 'P-S-C' : 'P-C-S'}
            </button>
          ))}
      </div>
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
  const [formazioneA, setFormazioneA] = useState<string[]>([]);
  const [formazioneB, setFormazioneB] = useState<string[]>([]);
  const [primaSquadraAlServizio, setPrimaSquadraAlServizio] = useState<Squadra>('A');
  const [palleggiatoreIdA, setPalleggiatoreIdA] = useState<string | null>(null);
  const [palleggiatoreIdB, setPalleggiatoreIdB] = useState<string | null>(null);
  const [giroA, setGiroA] = useState<Giro>('schiacciatore-centrale');
  const [giroB, setGiroB] = useState<Giro>('schiacciatore-centrale');
  const [liberiScelA, setLiberiScelA] = useState<string[]>([]);
  const [liberiScelB, setLiberiScelB] = useState<string[]>([]);

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
  // Il libero non e' mai tra i 6 titolari (in P1 batterebbe lui): entra da
  // solo al posto del centrale in seconda linea.
  const titolabiliA = giocatoriEleggibiliA.filter((g) => g.ruolo !== 'libero');
  const titolabiliB = giocatoriEleggibiliB.filter((g) => g.ruolo !== 'libero');

  const inCampoOrdinataA = formazioneA
    .map((id) => titolabiliA.find((g) => g.id === id))
    .filter((g): g is Player => Boolean(g));
  const inCampoOrdinataB = formazioneB
    .map((id) => titolabiliB.find((g) => g.id === id))
    .filter((g): g is Player => Boolean(g));

  // Se il palleggiatore scelto viene poi tolto dalla formazione, la scelta
  // decade silenziosamente invece di essere salvata come riferimento a un
  // giocatore non piu' titolare in questo set.
  const palleggiatoreEffettivoA = palleggiatoreEffettivo(formazioneA, titolabiliA, palleggiatoreIdA);
  const palleggiatoreEffettivoB = palleggiatoreEffettivo(formazioneB, titolabiliB, palleggiatoreIdB);

  // Un secondo tap mentre il primo e' ancora in volo partirebbe prima che il
  // DB abbia il set appena creato: il guard sincrono evita di aprirne due.
  const avvioInCorso = useRef(false);
  const [avvioInCorsoUi, setAvvioInCorsoUi] = useState(false);

  async function handleContinua() {
    if (!match || formazioneA.length !== 6 || formazioneB.length !== 6) return;
    if (avvioInCorso.current) return;
    avvioInCorso.current = true;
    setAvvioInCorsoUi(true);
    try {
      const set = await avviaSet({
        matchId: match.id,
        formazioneInizialeA: formazioneA,
        formazioneInizialeB: formazioneB,
        primaSquadraAlServizio,
        paleggiatoreIdA: palleggiatoreEffettivoA,
        paleggiatoreIdB: palleggiatoreEffettivoB,
        giroA: palleggiatoreEffettivoA ? giroA : null,
        giroB: palleggiatoreEffettivoB ? giroB : null,
      });
      navigate(`/partite/${match.id}/scouting/${set.id}`);
    } finally {
      avvioInCorso.current = false;
      setAvvioInCorsoUi(false);
    }
  }

  if (inAttesaSceltaLiberi) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <BarraNavigazione />
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
      <BarraNavigazione />
      <h1 className="mb-6 text-2xl font-bold">Formazione titolare</h1>
      <p className="mb-1">Tocca i giocatori nellordine di rotazione P1...P6 (P1 al servizio); tocca una casella piena per indicare il palleggiatore.</p>
      <p className="mb-4 text-sm text-slate-400">
        Il libero non va tra i 6: il libero entra da solo al posto del centrale in seconda linea (indica palleggiatore
        e sistema).
      </p>
      <div className="mb-6 flex h-64 flex-col">
        <CampoDaGioco inCampoA={inCampoOrdinataA} inCampoB={inCampoOrdinataB} modalita={{ tipo: 'inattivo' }} />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra A ({formazioneA.length}/6)</h2>
          <FormazioneGriglia
            sigla="a"
            titolabili={titolabiliA}
            formazione={formazioneA}
            onCambiaFormazione={setFormazioneA}
            palleggiatoreId={palleggiatoreEffettivoA}
            onCambiaPalleggiatore={setPalleggiatoreIdA}
            giro={giroA}
            onCambiaGiro={setGiroA}
          />
        </div>
        <div>
          <h2 className="mb-2 text-xl font-semibold">Squadra B ({formazioneB.length}/6)</h2>
          <FormazioneGriglia
            sigla="b"
            titolabili={titolabiliB}
            formazione={formazioneB}
            onCambiaFormazione={setFormazioneB}
            palleggiatoreId={palleggiatoreEffettivoB}
            onCambiaPalleggiatore={setPalleggiatoreIdB}
            giro={giroB}
            onCambiaGiro={setGiroB}
          />
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
        disabled={formazioneA.length !== 6 || formazioneB.length !== 6 || avvioInCorsoUi}
        className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-40"
      >
        Inizia partita
      </button>
    </main>
  );
}
