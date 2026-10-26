import { useState } from 'react';
import type { Squadra } from '@/domain/types';

interface Props {
  punteggioA: number;
  punteggioB: number;
  rotazioneA: string[];
  rotazioneB: string[];
  nomeGiocatore: (id: string) => string;
  occupato: boolean;
  onRuota: (squadra: Squadra, passi: number) => void;
  onCorreggiPunteggio: (punteggioA: number, punteggioB: number) => void;
  onChiudi: () => void;
}

const COLORE: Record<Squadra, string> = { A: 'text-blue-400', B: 'text-orange-400' };

function BloccoGiro({
  squadra,
  rotazione,
  nomeGiocatore,
  occupato,
  onRuota,
}: {
  squadra: Squadra;
  rotazione: string[];
  nomeGiocatore: (id: string) => string;
  occupato: boolean;
  onRuota: (squadra: Squadra, passi: number) => void;
}) {
  const sigla = squadra.toLowerCase();
  return (
    <div className="rounded-lg bg-slate-800 p-3" data-testid={`giro-${sigla}`}>
      <h3 className={`mb-2 font-semibold ${COLORE[squadra]}`}>Squadra {squadra}</h3>
      <ul className="mb-3 grid grid-cols-2 gap-1 text-sm">
        {rotazione.map((id, indice) => (
          <li key={id} className="truncate rounded bg-slate-900 px-2 py-1">
            P{indice + 1}: {nomeGiocatore(id)}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={occupato}
          onClick={() => onRuota(squadra, -1)}
          data-testid={`ruota-${sigla}-indietro`}
          className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ↺ Indietro
        </button>
        <button
          type="button"
          disabled={occupato}
          onClick={() => onRuota(squadra, 1)}
          data-testid={`ruota-${sigla}-avanti`}
          className="flex-1 rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold disabled:opacity-40"
        >
          ↻ Avanti
        </button>
      </div>
    </div>
  );
}

// Punteggio di una squadra: si scrive il numero oppure si toglie/aggiunge un
// punto con i tasti (mai sotto zero).
function CampoPunteggio({ squadra, valore, onCambia }: { squadra: Squadra; valore: string; onCambia: (v: string) => void }) {
  const sigla = squadra.toLowerCase();
  const numero = /^\d+$/.test(valore.trim()) ? Number(valore) : 0;
  const tasto = 'h-11 w-11 rounded-lg bg-slate-700 text-xl font-bold disabled:opacity-40';
  return (
    <div className="text-sm">
      <span className={`block font-semibold ${COLORE[squadra]}`}>Squadra {squadra}</span>
      <div className="mt-1 flex items-center gap-1">
        <button
          type="button"
          aria-label={`Togli un punto alla squadra ${squadra}`}
          disabled={numero <= 0}
          onClick={() => onCambia(String(numero - 1))}
          data-testid={`correzione-${sigla}-meno`}
          className={tasto}
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label={`Punteggio squadra ${squadra}`}
          value={valore}
          onChange={(e) => onCambia(e.target.value)}
          data-testid={`correzione-punteggio-${sigla}`}
          className="w-20 rounded-lg bg-slate-800 px-3 py-2 text-center text-lg"
        />
        <button
          type="button"
          aria-label={`Aggiungi un punto alla squadra ${squadra}`}
          onClick={() => onCambia(String(numero + 1))}
          data-testid={`correzione-${sigla}-piu`}
          className={tasto}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function CorrezioniPanel({
  punteggioA,
  punteggioB,
  rotazioneA,
  rotazioneB,
  nomeGiocatore,
  occupato,
  onRuota,
  onCorreggiPunteggio,
  onChiudi,
}: Props) {
  const [valoreA, setValoreA] = useState(String(punteggioA));
  const [valoreB, setValoreB] = useState(String(punteggioB));

  const intero = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : null);
  const nuovoA = intero(valoreA);
  const nuovoB = intero(valoreB);
  const valido = nuovoA !== null && nuovoB !== null;
  const invariato = nuovoA === punteggioA && nuovoB === punteggioB;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4" data-testid="modal-correzioni">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-slate-900 p-5 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Correzioni</h2>
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold">
            Chiudi
          </button>
        </div>

        <h3 className="mb-1 font-semibold">Gira la formazione</h3>
        <p className="mb-2 text-sm text-slate-400">
          Sposta tutti i giocatori della squadra tenendoli insieme. Avanti: chi è in P5 passa in P4. Indietro: chi è
          in P4 passa in P5. Non cambia punteggio né servizio.
        </p>
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <BloccoGiro squadra="A" rotazione={rotazioneA} nomeGiocatore={nomeGiocatore} occupato={occupato} onRuota={onRuota} />
          <BloccoGiro squadra="B" rotazione={rotazioneB} nomeGiocatore={nomeGiocatore} occupato={occupato} onRuota={onRuota} />
        </div>

        <h3 className="mb-1 font-semibold">Correggi il punteggio</h3>
        <p className="mb-2 text-sm text-slate-400">
          Scrivi il punteggio giusto o usa − e +: le azioni già registrate restano, rotazione e servizio non cambiano. I punti
          successivi si sommano a questo. &quot;Annulla&quot; toglie l&apos;ultima correzione.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <CampoPunteggio squadra="A" valore={valoreA} onCambia={setValoreA} />
          <CampoPunteggio squadra="B" valore={valoreB} onCambia={setValoreB} />
          <button
            type="button"
            disabled={!valido || invariato || occupato}
            onClick={() => {
              onCorreggiPunteggio(nuovoA!, nuovoB!);
              onChiudi();
            }}
            data-testid="applica-correzione-punteggio"
            className="rounded-lg bg-blue-700 px-5 py-2 text-lg font-semibold disabled:opacity-40"
          >
            Applica
          </button>
        </div>
      </div>
    </div>
  );
}
