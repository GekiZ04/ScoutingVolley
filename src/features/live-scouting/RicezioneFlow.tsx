import { useState } from 'react';
import type { Valutazione } from '@/domain/types';
import { ZoneGrid } from '@/components/ZoneGrid';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface GiocatoreInCampo {
  id: string;
  numero: number;
  nome: string;
}

export interface DatiRicezione {
  giocatoreId: string;
  valutazione: Valutazione;
  zona: number;
}

type Passo = 'giocatore' | 'valutazione' | 'zona';

export function RicezioneFlow({
  giocatoriInCampo,
  onCompleta,
}: {
  giocatoriInCampo: GiocatoreInCampo[];
  onCompleta: (dati: DatiRicezione) => void;
}) {
  const [passo, setPasso] = useState<Passo>('giocatore');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);

  if (passo === 'giocatore') {
    return (
      <div className="grid grid-cols-3 gap-3">
        {giocatoriInCampo.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => {
              setGiocatoreId(g.id);
              setPasso('valutazione');
            }}
            className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
          >
            #{g.numero} {g.nome}
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

  return (
    <ZoneGrid
      variante="origine"
      onSeleziona={(zona) => {
        onCompleta({ giocatoreId: giocatoreId!, valutazione: valutazione!, zona });
      }}
    />
  );
}
