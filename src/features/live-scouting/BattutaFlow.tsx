import { useState } from 'react';
import type { Player, TipoBattuta, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';

export interface DatiBattuta {
  tipoBattuta: TipoBattuta;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
}

type Passo = 'tipo' | 'origine' | 'destinazione' | 'esito';

const TIPI_BATTUTA: { valore: TipoBattuta; etichetta: string }[] = [
  { valore: 'flottante', etichetta: 'Flottante' },
  { valore: 'salto_flottante', etichetta: 'Salto flottante' },
  { valore: 'salto_spin', etichetta: 'Salto spin' },
];

export function BattutaFlow({
  inCampoA,
  inCampoB,
  ultimaTraiettoria,
  onCompleta,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  ultimaTraiettoria?: Traiettoria | null;
  onCompleta: (dati: DatiBattuta) => void;
}) {
  const [passo, setPasso] = useState<Passo>('tipo');
  const [tipoBattuta, setTipoBattuta] = useState<TipoBattuta | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);
  const [destinazione, setDestinazione] = useState<Punto | null>(null);

  const controlli = (() => {
    if (passo === 'tipo') {
      return (
        <div className="flex gap-3">
          {TIPI_BATTUTA.map((tipo) => (
            <button
              key={tipo.valore}
              type="button"
              onClick={() => {
                setTipoBattuta(tipo.valore);
                setPasso('origine');
              }}
              className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
            >
              {tipo.etichetta}
            </button>
          ))}
        </div>
      );
    }
    if (passo === 'esito') {
      return (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() =>
              onCompleta({ tipoBattuta: tipoBattuta!, valutazione: '=', origine: origine!, destinazione: destinazione! })
            }
            className="rounded-xl bg-red-800 px-8 py-5 text-xl font-semibold text-white"
          >
            Errore
          </button>
          <button
            type="button"
            onClick={() =>
              onCompleta({ tipoBattuta: tipoBattuta!, valutazione: '+', origine: origine!, destinazione: destinazione! })
            }
            className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white"
          >
            Buona
          </button>
        </div>
      );
    }
    return (
      <p className="text-sm text-slate-400">
        Tocca il campo per registrare {passo === 'origine' ? "l'origine" : 'la destinazione'}.
      </p>
    );
  })();

  const modalita = (() => {
    if (passo === 'origine') {
      return { tipo: 'seleziona-punto' as const, onSeleziona: (p: Punto) => { setOrigine(p); setPasso('destinazione'); } };
    }
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => { setDestinazione(p); setPasso('esito'); },
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
        origineSelezionata={origine}
        ultimaTraiettoria={ultimaTraiettoria}
      />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
