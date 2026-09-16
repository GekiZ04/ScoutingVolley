import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { determinaPassoAtteso } from './flowLogic';
import { BattutaFlow } from './BattutaFlow';

export function LiveScoutingScreen() {
  const { matchId, setId } = useParams<{ matchId: string; setId: string }>();
  const caricaSet = useLiveMatchStore((s) => s.caricaSet);
  const rallies = useLiveMatchStore((s) => s.rallies);
  const azioni = useLiveMatchStore((s) => s.azioni);
  const annullaUltimaAzione = useLiveMatchStore((s) => s.annullaUltimaAzione);
  const chiudiRallyManuale = useLiveMatchStore((s) => s.chiudiRallyManuale);
  const registraAzione = useLiveMatchStore((s) => s.registraAzione);
  const derivato = useLiveMatchStore((s) => (s.set ? s.statoDerivato() : null));

  const setRecord = useLiveQuery(() => db.sets.get(setId!), [setId]);
  const match = useLiveQuery(() => db.matches.get(matchId!), [matchId]);
  const giocatori = useLiveQuery(async () => {
    if (!match) return undefined;
    const [giocatoriA, giocatoriB] = await Promise.all([
      db.players.where('teamId').equals(match.squadraAId).toArray(),
      db.players.where('teamId').equals(match.squadraBId).toArray(),
    ]);
    return [...giocatoriA, ...giocatoriB];
  }, [match]);

  useEffect(() => {
    if (!setRecord) return;
    caricaDatiSet(setRecord.id).then((dati) => caricaSet({ set: setRecord, ...dati }));
  }, [setRecord, caricaSet]);

  if (!derivato || !giocatori) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  const nomeGiocatore = (id: string) => {
    const giocatore = giocatori?.find((g) => g.id === id);
    return giocatore ? `#${giocatore.numero} ${giocatore.nome}` : id;
  };

  const rallyAperto = rallies.find((r) => r.numero === derivato.rallyApertoNumero);
  const azioniRallyAperto = rallyAperto ? azioni.filter((a) => a.rallyId === rallyAperto.id) : [];
  const passoAtteso = determinaPassoAtteso(azioniRallyAperto);

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 p-4 text-white">
      <header className="mb-4 flex items-center justify-between rounded-lg bg-slate-900 px-6 py-4">
        <button
          type="button"
          onClick={() => annullaUltimaAzione()}
          className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold"
        >
          Annulla ultima azione
        </button>
        <div className="text-3xl font-bold" data-testid="punteggio">
          {derivato.punteggioA} : {derivato.punteggioB}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_A')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Punto A
          </button>
          <button
            type="button"
            onClick={() => chiudiRallyManuale('punto_B')}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Punto B
          </button>
        </div>
      </header>
      <section className="mb-4 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Squadra A in campo</h2>
          <div className="flex flex-wrap gap-2" data-testid="rotazione-a">
            {derivato.rotazioneA.map((giocatoreId, indice) => (
              <span key={giocatoreId} className="rounded bg-slate-800 px-3 py-1 text-sm">
                P{indice + 1}: {nomeGiocatore(giocatoreId)}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-slate-900 p-4">
          <h2 className="mb-2 font-semibold">Squadra B in campo</h2>
          <div className="flex flex-wrap gap-2" data-testid="rotazione-b">
            {derivato.rotazioneB.map((giocatoreId, indice) => (
              <span key={giocatoreId} className="rounded bg-slate-800 px-3 py-1 text-sm">
                P{indice + 1}: {nomeGiocatore(giocatoreId)}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="flex-1 rounded-lg bg-slate-900 p-4" data-testid="area-tap-flow">
        {passoAtteso === 'battuta' && (
          <BattutaFlow
            onCompleta={(dati) => {
              const giocatoreId =
                derivato.squadraAlServizio === 'A' ? derivato.rotazioneA[0] : derivato.rotazioneB[0];
              registraAzione({
                squadra: derivato.squadraAlServizio,
                giocatoreId,
                fondamentale: 'battuta',
                ...dati,
              });
            }}
          />
        )}
        {passoAtteso !== 'battuta' && <p className="text-lg">Prossimo fondamentale atteso: {passoAtteso}</p>}
      </section>
    </main>
  );
}
