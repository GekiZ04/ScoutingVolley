import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '@/db/schema';
import { caricaDatiSet } from '@/db/scouting';
import { aggiornaStatoSet, aggiornaStatoPartita } from '@/db/matches';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { determinaPassoAtteso } from './flowLogic';
import { BattutaFlow } from './BattutaFlow';
import { RicezioneFlow } from './RicezioneFlow';
import { AttaccoMuroFlow } from './AttaccoMuroFlow';
import { SubstitutionModal } from './SubstitutionModal';
import { squadraOpposta } from '@/domain/reducer';

export function LiveScoutingScreen() {
  const { matchId, setId } = useParams<{ matchId: string; setId: string }>();
  const navigate = useNavigate();
  const caricaSet = useLiveMatchStore((s) => s.caricaSet);
  const rallies = useLiveMatchStore((s) => s.rallies);
  const azioni = useLiveMatchStore((s) => s.azioni);
  const annullaUltimaAzione = useLiveMatchStore((s) => s.annullaUltimaAzione);
  const chiudiRallyManuale = useLiveMatchStore((s) => s.chiudiRallyManuale);
  const registraAzione = useLiveMatchStore((s) => s.registraAzione);
  const aggiungiSostituzione = useLiveMatchStore((s) => s.aggiungiSostituzione);
  const aggiungiTimeout = useLiveMatchStore((s) => s.aggiungiTimeout);
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

  const [sostituzioneAperta, setSostituzioneAperta] = useState(false);

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

  const squadraRicevente = derivato.squadraAlServizio === 'A' ? 'B' : 'A';
  const rotazioneRicevente = squadraRicevente === 'A' ? derivato.rotazioneA : derivato.rotazioneB;
  const giocatoriInCampoRicezione = rotazioneRicevente
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const ultimaAzioneRallyAperto = azioniRallyAperto[azioniRallyAperto.length - 1];
  const squadraProtagonista = ultimaAzioneRallyAperto
    ? passoAtteso === 'attacco'
      ? ultimaAzioneRallyAperto.squadra
      : squadraOpposta(ultimaAzioneRallyAperto.squadra)
    : null;
  const rotazioneProtagonista =
    squadraProtagonista === 'A' ? derivato.rotazioneA : squadraProtagonista === 'B' ? derivato.rotazioneB : [];
  const giocatoriInCampoAttaccoMuro = rotazioneProtagonista
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const inCampoA = derivato.rotazioneA
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const inCampoB = derivato.rotazioneB
    .map((id) => giocatori?.find((g) => g.id === id))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));
  const panchinaA = (giocatori ?? []).filter(
    (g) => g.teamId === match?.squadraAId && g.attivo && !derivato.rotazioneA.includes(g.id),
  );
  const panchinaB = (giocatori ?? []).filter(
    (g) => g.teamId === match?.squadraBId && g.attivo && !derivato.rotazioneB.includes(g.id),
  );

  const formatoSet = match?.formatoSet ?? 5;
  const setDecisivo = setRecord?.numero === formatoSet;
  const targetPunti = setDecisivo ? (match?.puntiSetDecisivo ?? 15) : (match?.puntiSet ?? 25);
  const setAlPunto =
    (derivato.punteggioA >= targetPunti || derivato.punteggioB >= targetPunti) &&
    Math.abs(derivato.punteggioA - derivato.punteggioB) >= 2;

  async function handleChiudiSet() {
    if (!setRecord || derivato!.punteggioA === derivato!.punteggioB) return;
    const vincitore = derivato!.punteggioA > derivato!.punteggioB ? 'A' : 'B';
    await aggiornaStatoSet(setRecord.id, 'concluso', vincitore);
    navigate(`/partite/${matchId}/formazione`);
  }

  async function handleChiudiPartita() {
    if (!matchId) return;
    await aggiornaStatoPartita(matchId, 'conclusa');
    navigate('/storico');
  }

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
          <button
            type="button"
            onClick={() => setSostituzioneAperta(true)}
            className="rounded-lg bg-slate-700 px-4 py-2 text-sm"
          >
            Sostituzione
          </button>
          <button type="button" onClick={() => aggiungiTimeout('A')} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
            Timeout A
          </button>
          <button type="button" onClick={() => aggiungiTimeout('B')} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
            Timeout B
          </button>
          <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-slate-700 px-4 py-2 text-sm">
            Chiudi set
          </button>
          <button type="button" onClick={handleChiudiPartita} className="rounded-lg bg-red-900 px-4 py-2 text-sm">
            Chiudi partita
          </button>
        </div>
      </header>
      {setAlPunto && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-amber-700 px-4 py-3" data-testid="banner-fine-set">
          <span>
            Set al punto {derivato.punteggioA}-{derivato.punteggioB} — chiudere?
          </span>
          <button type="button" onClick={handleChiudiSet} className="rounded-lg bg-amber-900 px-4 py-2 font-semibold">
            Chiudi set
          </button>
        </div>
      )}
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
        {passoAtteso === 'ricezione' && (
          <RicezioneFlow
            giocatoriInCampo={giocatoriInCampoRicezione}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraRicevente,
                fondamentale: 'ricezione',
                tipoBattuta: null,
                direzione: null,
                ...dati,
              })
            }
          />
        )}
        {(passoAtteso === 'attacco' || passoAtteso === 'bivio') && squadraProtagonista && (
          <AttaccoMuroFlow
            mostraBivio={passoAtteso === 'bivio'}
            giocatoriInCampo={giocatoriInCampoAttaccoMuro}
            onCompleta={(dati) =>
              registraAzione({
                squadra: squadraProtagonista,
                tipoBattuta: null,
                ...dati,
              })
            }
          />
        )}
      </section>
      {sostituzioneAperta && (
        <SubstitutionModal
          inCampoA={inCampoA}
          inCampoB={inCampoB}
          panchinaA={panchinaA}
          panchinaB={panchinaB}
          onConferma={(dati) => {
            aggiungiSostituzione(dati);
            setSostituzioneAperta(false);
          }}
          onChiudi={() => setSostituzioneAperta(false)}
        />
      )}
    </main>
  );
}
