import { useState } from 'react';
import type { Player, TipoBattuta, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiBattuta {
  tipoBattuta: TipoBattuta;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
}

type Passo = 'tipo' | 'valutazione' | 'origine' | 'destinazione';

const TIPI_BATTUTA: { valore: TipoBattuta; etichetta: string }[] = [
  { valore: 'flottante', etichetta: 'Flottante' },
  { valore: 'salto_flottante', etichetta: 'Salto flottante' },
  { valore: 'salto_spin', etichetta: 'Salto spin' },
];

export function BattutaFlow({
  inCampoA,
  inCampoB,
  onCompleta,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  onCompleta: (dati: DatiBattuta) => void;
}) {
  const [passo, setPasso] = useState<Passo>('tipo');
  const [tipoBattuta, setTipoBattuta] = useState<TipoBattuta | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);

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
                setPasso('valutazione');
              }}
              className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
            >
              {tipo.etichetta}
            </button>
          ))}
        </div>
      );
    }
    if (passo === 'valutazione') {
      return (
        <ValutazioneButtons
          onSeleziona={(v) => {
            setValutazione(v);
            setPasso('origine');
          }}
        />
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
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => {
          setOrigine(p);
          setPasso('destinazione');
        },
      };
    }
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) =>
          onCompleta({ tipoBattuta: tipoBattuta!, valutazione: valutazione!, origine: origine!, destinazione: p }),
      };
    }
    return { tipo: 'inattivo' as const };
  })();

  return (
    <div className="flex flex-col gap-4">
      <CampoDaGioco inCampoA={inCampoA} inCampoB={inCampoB} modalita={modalita} origineSelezionata={origine} />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
