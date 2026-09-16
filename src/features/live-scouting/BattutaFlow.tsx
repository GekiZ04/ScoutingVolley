import { useState } from 'react';
import type { TipoBattuta, Valutazione } from '@/domain/types';
import { ZoneGrid } from '@/components/ZoneGrid';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiBattuta {
  tipoBattuta: TipoBattuta;
  valutazione: Valutazione;
  zona: number;
  direzione: number;
}

type Passo = 'tipo' | 'valutazione' | 'zona' | 'direzione';

const TIPI_BATTUTA: { valore: TipoBattuta; etichetta: string }[] = [
  { valore: 'flottante', etichetta: 'Flottante' },
  { valore: 'salto_flottante', etichetta: 'Salto flottante' },
  { valore: 'salto_spin', etichetta: 'Salto spin' },
];

export function BattutaFlow({ onCompleta }: { onCompleta: (dati: DatiBattuta) => void }) {
  const [passo, setPasso] = useState<Passo>('tipo');
  const [tipoBattuta, setTipoBattuta] = useState<TipoBattuta | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [zona, setZona] = useState<number | null>(null);

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
          setPasso('zona');
        }}
      />
    );
  }

  if (passo === 'zona') {
    return (
      <ZoneGrid
        variante="origine"
        onSeleziona={(z) => {
          setZona(z);
          setPasso('direzione');
        }}
      />
    );
  }

  return (
    <ZoneGrid
      variante="destinazione"
      onSeleziona={(direzione) => {
        onCompleta({ tipoBattuta: tipoBattuta!, valutazione: valutazione!, zona: zona!, direzione });
      }}
    />
  );
}
