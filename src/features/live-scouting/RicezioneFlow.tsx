import { forwardRef, useImperativeHandle, useState } from 'react';
import type { Player, Squadra, Valutazione } from '@/domain/types';
import { CampoDaGioco, type PosizioniCampo, type Traiettoria } from '@/components/CampoDaGioco';
import type { BozzaFlusso } from '@/domain/annulla';
import type { ControlloFlusso } from './controlloFlusso';

export interface DatiRicezione {
  giocatoreId: string;
  valutazione: Valutazione;
  // Squadra del momento in cui si tocca il giocatore (vedi BattutaFlow).
  squadra: Squadra;
}

const VALUTAZIONI_RICEZIONE: Valutazione[] = ['#', '+', '!', '-', '/', '='];

// 'fatto' e' un passo terminale inerte: l'azione e' stata consegnata al parent,
// che la salva in modo asincrono e poi rimonta il flusso. Senza questo passo il
// campo resterebbe tappabile durante l'attesa e un secondo tap registrerebbe
// un'azione duplicata.
type Passo = 'giocatore' | 'valutazione' | 'fatto';

export const RicezioneFlow = forwardRef<
  ControlloFlusso,
  {
    inCampoA: Player[];
    inCampoB: Player[];
    squadraRicevente: Squadra;
    ultimaTraiettoria?: Traiettoria | null;
    posizioni?: PosizioniCampo;
    onCompleta: (dati: DatiRicezione) => void;
    iniziale?: Extract<BozzaFlusso, { flusso: 'ricezione' }>;
  }
>(function RicezioneFlow({ inCampoA, inCampoB, squadraRicevente, ultimaTraiettoria, posizioni, onCompleta, iniziale }, ref) {
  const [passo, setPasso] = useState<Passo>(iniziale ? 'valutazione' : 'giocatore');
  const [ricevitore, setRicevitore] = useState<{ giocatoreId: string; squadra: Squadra } | null>(
    iniziale ? { giocatoreId: iniziale.giocatoreId, squadra: iniziale.squadra } : null,
  );

  useImperativeHandle(ref, () => ({
    indietro: () => {
      if (passo !== 'valutazione') return false;
      setRicevitore(null);
      setPasso('giocatore');
      return true;
    },
  }));

  function completa(valutazione: Valutazione) {
    setPasso('fatto');
    onCompleta({ giocatoreId: ricevitore!.giocatoreId, valutazione, squadra: ricevitore!.squadra });
  }

  const controlli = (() => {
    if (passo === 'fatto') return <p className="text-sm text-slate-400">Azione registrata.</p>;
    if (passo === 'valutazione') {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-400">Tocca la valutazione della ricezione.</p>
          <div className="flex gap-2">
            {VALUTAZIONI_RICEZIONE.map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`ricezione-valutazione-${v}`}
                onClick={() => completa(v)}
                className="h-14 w-14 rounded-xl bg-blue-700 text-xl font-bold text-white"
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      );
    }
    return <p className="text-sm text-slate-400">Tocca il campo per registrare il giocatore.</p>;
  })();

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraRicevente,
        onSeleziona: (id: string) => {
          setRicevitore({ giocatoreId: id, squadra: squadraRicevente });
          setPasso('valutazione');
        },
      };
    }
    return { tipo: 'inattivo' as const };
  })();

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <CampoDaGioco
        inCampoA={inCampoA}
        inCampoB={inCampoB}
        modalita={modalita}
        ultimaTraiettoria={ultimaTraiettoria}
        posizioni={posizioni}
      />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
});
