import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { caricaRiepilogoPartita, type RiepilogoPartita } from '@/db/matchSummary';
import { contaSetVinti } from '@/domain/matchProgress';
import { cronologiaSet } from '@/domain/cronologiaSet';
import {
  cellaSetGiocatore,
  durataSet,
  parzialiSet,
  puntiVintiPerFonte,
  type CellaSet,
} from '@/domain/tabellinoExtra';
import { valoriGiocatoreTabellino, valoriTotaleTabellino } from './righeTabellino';
import { generaPdfReport, scaricaPdf } from '@/features/export/exportPdf';
import { generaXlsxReport, scaricaXlsx } from '@/features/export/exportXlsx';
import type { Squadra, Team } from '@/domain/types';
import { VistaRotazione } from '@/features/rotazioni/VistaRotazione';
import { TabellinoSquadra, type RigaTabellinoSquadra } from './TabellinoSquadra';

const CELLA = 'border border-black px-2 py-0.5 text-center';

function sommaDurate(durate: string[]): string {
  const minuti = durate.reduce((somma, d) => {
    const [h, m] = d.split('.').map(Number);
    return somma + h * 60 + m;
  }, 0);
  return `${Math.floor(minuti / 60)}.${String(minuti % 60).padStart(2, '0')}`;
}

export function TabellinoPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const [dati, setDati] = useState<RiepilogoPartita | null>(null);
  const [nomi, setNomi] = useState<{ A: string; B: string }>({ A: 'Squadra A', B: 'Squadra B' });
  const [vista, setVista] = useState('tutti');
  const [errore, setErrore] = useState<string | null>(null);
  const [rotazioni, setRotazioni] = useState<Squadra | null>(null);

  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        const riepilogo = await caricaRiepilogoPartita(matchId);
        setDati(riepilogo);
        const { data } = await supabase
          .from('teams')
          .select('*')
          .in('id', [riepilogo.match.squadraAId, riepilogo.match.squadraBId]);
        const squadre = (data ?? []) as Team[];
        setNomi({
          A: squadre.find((t) => t.id === riepilogo.match.squadraAId)?.nome ?? 'Squadra A',
          B: squadre.find((t) => t.id === riepilogo.match.squadraBId)?.nome ?? 'Squadra B',
        });
      } catch {
        setErrore('Partita non trovata.');
      }
    })();
  }, [matchId]);

  const calcolato = useMemo(() => {
    if (!dati) return null;
    const { match, giocatori, riepiloghi, tutteLeAzioni, tutteLeRallies, tutteLeSostituzioni } = dati;
    const setScelto = vista === 'tutti' ? null : riepiloghi.find((r) => r.set.id === vista)?.set ?? null;
    const azioni = setScelto ? tutteLeAzioni.filter((a) => a.setId === setScelto.id) : tutteLeAzioni;
    const rallies = setScelto ? tutteLeRallies.filter((r) => r.setId === setScelto.id) : tutteLeRallies;

    const infoSet = riepiloghi.map(({ set, punteggioA, punteggioB }) => {
      const azioniSet = tutteLeAzioni.filter((a) => a.setId === set.id);
      const ralliesSet = tutteLeRallies.filter((r) => r.setId === set.id);
      const sostSet = tutteLeSostituzioni.filter((s) => s.setId === set.id);
      return {
        set,
        punteggioA,
        punteggioB,
        durata: durataSet(azioniSet),
        parziali: parzialiSet(cronologiaSet(set, ralliesSet, azioniSet, sostSet)),
      };
    });

    const costruisci = (squadra: Squadra) => {
      const teamId = squadra === 'A' ? match.squadraAId : match.squadraBId;
      const selezionati = (squadra === 'A' ? match.liberiSelezionatiA : match.liberiSelezionatiB) ?? [];
      const roster = giocatori.filter((g) => g.teamId === teamId);
      const visibili = setScelto
        ? roster.filter(
            (g) =>
              azioni.some((a) => a.giocatoreId === g.id) ||
              cellaSetGiocatore({ set: setScelto, sostituzioni: tutteLeSostituzioni, azioni, giocatore: g }) !== null,
          )
        : roster;
      const righe: RigaTabellinoSquadra[] = visibili.map((g) => ({
        numero: g.numero,
        nome: g.nome,
        libero: g.ruolo === 'libero' || selezionati.includes(g.id),
        valori: valoriGiocatoreTabellino(azioni, rallies, g.id),
        celleSet: riepiloghi.map(({ set }): CellaSet =>
          cellaSetGiocatore({
            set,
            sostituzioni: tutteLeSostituzioni,
            azioni: tutteLeAzioni.filter((a) => a.setId === set.id),
            giocatore: g,
          }),
        ),
      }));
      const totale = valoriTotaleTabellino(azioni, rallies, squadra);
      const puntiVinti = setScelto
        ? [{ etichetta: `Set ${setScelto.numero}`, valori: puntiVintiPerFonte(azioni, rallies, squadra) }]
        : [
            ...riepiloghi.map(({ set }) => ({
              etichetta: `Set ${set.numero}`,
              valori: puntiVintiPerFonte(
                tutteLeAzioni.filter((a) => a.setId === set.id),
                tutteLeRallies.filter((r) => r.setId === set.id),
                squadra,
              ),
            })),
            { etichetta: 'Totale', valori: puntiVintiPerFonte(azioni, rallies, squadra) },
          ];
      const primaBattuta = [0, 1, 2, 3, 4].map(
        (i) => riepiloghi[i]?.set.primaSquadraAlServizio === squadra,
      );
      return { righe, totale, puntiVinti, primaBattuta };
    };

    const vinti = contaSetVinti(riepiloghi.map((r) => r.set));
    const setVintiA = vinti.A;
    const setVintiB = vinti.B;
    return { infoSet, A: costruisci('A'), B: costruisci('B'), setVintiA, setVintiB };
  }, [dati, vista]);

  async function esporta(azione: () => Promise<void>) {
    try {
      setErrore(null);
      await azione();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore durante l'esportazione");
    }
  }

  const chiudi = () => navigate(-1);

  if (!dati || !calcolato) {
    return (
      <main className="min-h-screen bg-white p-6 text-black">
        {errore ? (
          <>
            <p>{errore}</p>
            <button type="button" onClick={chiudi} className="mt-4 border border-black px-3 py-1 text-sm">
              Chiudi
            </button>
          </>
        ) : (
          'Caricamento...'
        )}
      </main>
    );
  }

  const { match, riepiloghi } = dati;
  const bottone = 'border border-black bg-white px-3 py-1 text-sm font-semibold';

  return (
    <main className="min-h-screen bg-white p-4 text-black">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <label className="flex items-center gap-2 text-sm font-semibold">
          Vista
          <select
            value={vista}
            onChange={(e) => setVista(e.target.value)}
            className="border border-black bg-white px-2 py-1"
          >
            <option value="tutti">Tutti</option>
            {riepiloghi.map(({ set }) => (
              <option key={set.id} value={set.id}>
                Set {set.numero}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            className={bottone}
            onClick={() => esporta(async () => scaricaPdf(`partita-${match.data}.pdf`, await generaPdfReport(match.id)))}
          >
            PDF
          </button>
          <button
            type="button"
            className={bottone}
            onClick={() =>
              esporta(async () => scaricaXlsx(`partita-${match.data}-statistiche.xlsx`, await generaXlsxReport(match.id)))
            }
          >
            Excel
          </button>
          <button type="button" className={bottone} onClick={() => setRotazioni('A')}>
            Rotazioni
          </button>
          <button type="button" className={bottone} onClick={() => window.print()}>
            Stampa
          </button>
          <button type="button" className={bottone} onClick={chiudi}>
            Chiudi
          </button>
        </div>
      </div>
      {errore && (
        <div role="alert" className="mb-4 border border-black px-3 py-2 text-sm">
          {errore}
        </div>
      )}

      <header className="mb-6">
        <h1 className="text-xl font-bold" data-testid="risultato-set">
          {nomi.A} {calcolato.setVintiA} - {calcolato.setVintiB} {nomi.B}
        </h1>
        <p className="mb-2 text-sm">{match.data}</p>
        <table className="border-collapse text-xs">
          <thead>
            <tr className="font-bold">
              <th className={CELLA}>Set</th>
              <th className={CELLA}>Durata</th>
              <th className={CELLA} colSpan={3}>
                Punteggi Parziali
              </th>
              <th className={CELLA}>Finali</th>
            </tr>
          </thead>
          <tbody>
            {calcolato.infoSet.map(({ set, punteggioA, punteggioB, durata, parziali }) => (
              <tr key={set.id}>
                <td className={CELLA}>{set.numero}</td>
                <td className={CELLA} data-testid={`durata-set-${set.numero}`}>
                  {durata}
                </td>
                {[8, 16, 21].map((soglia, i) => (
                  <td key={soglia} className={CELLA} data-testid={`parziale-set-${set.numero}-${soglia}`}>
                    {parziali[i] ?? ''}
                  </td>
                ))}
                <td className={CELLA}>
                  {punteggioA}-{punteggioB}
                </td>
              </tr>
            ))}
            <tr className="font-bold">
              <td className={CELLA}>Totale</td>
              <td className={CELLA}>{sommaDurate(calcolato.infoSet.map((i) => i.durata))}</td>
              <td className={CELLA} colSpan={3} />
              <td className={CELLA}>
                {calcolato.infoSet.reduce((s, i) => s + i.punteggioA, 0)}-
                {calcolato.infoSet.reduce((s, i) => s + i.punteggioB, 0)}
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      {(['A', 'B'] as const).map((squadra) => (
        <div key={squadra} data-testid={`tabellino-${squadra}`}>
          <TabellinoSquadra
            nomeSquadra={nomi[squadra]}
            righe={calcolato[squadra].righe}
            totale={calcolato[squadra].totale}
            puntiVinti={calcolato[squadra].puntiVinti}
            colonneSet={{ primaBattuta: calcolato[squadra].primaBattuta }}
          />
        </div>
      ))}

      <footer className="text-[11px]">
        <p>
          <strong>Legenda.</strong> Set: numero nel quadratino = posizione di partenza (grassetto = palleggiatore);
          rettangolo vuoto = entrato in campo; cerchio sul numero del set = squadra che ha battuto per prima; L = libero.
          Tot = punti, BP = punti in battuta (break point), V-P = punti vinti meno persi. Err = errori, Pt = punti,
          Mur = murato, Pos% = ricezione positiva, Prf% = ricezione perfetta, Eff% = efficienza. Er.Av = errori avversari.
        </p>
      </footer>
      {rotazioni && (
        <VistaRotazione
          squadra={rotazioni}
          nomeSquadra={nomi[rotazioni]}
          giocatori={dati.giocatori}
          dati={riepiloghi.map(({ set }) => ({
            set,
            rallies: dati.tutteLeRallies.filter((r) => r.setId === set.id),
            azioni: dati.tutteLeAzioni.filter((a) => a.setId === set.id),
            sostituzioni: dati.tutteLeSostituzioni.filter((x) => x.setId === set.id),
          }))}
          zonaIniziale={1}
          onChiudi={() => setRotazioni(null)}
          onCambiaSquadra={setRotazioni}
        />
      )}
    </main>
  );
}
