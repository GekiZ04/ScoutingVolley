import { useState } from 'react';
import type { Valutazione } from '@/domain/types';
import { ZoneGrid } from '@/components/ZoneGrid';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';
import type { GiocatoreInCampo } from './RicezioneFlow';

export interface DatiAttaccoMuro {
  fondamentale: 'attacco' | 'muro';
  giocatoreId: string;
  valutazione: Valutazione;
  zona: number;
  direzione: number;
}

type Passo = 'bivio' | 'giocatore' | 'valutazione' | 'zona' | 'direzione';

export function AttaccoMuroFlow({
  mostraBivio,
  giocatoriInCampo,
  onCompleta,
}: {
  mostraBivio: boolean;
  giocatoriInCampo: GiocatoreInCampo[];
  onCompleta: (dati: DatiAttaccoMuro) => void;
}) {
  const [passo, setPasso] = useState<Passo>(mostraBivio ? 'bivio' : 'giocatore');
  const [fondamentale, setFondamentale] = useState<'attacco' | 'muro'>('attacco');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [zona, setZona] = useState<number | null>(null);

  if (passo === 'bivio') {
    return (
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setFondamentale('muro');
            setPasso('giocatore');
          }}
          className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white"
        >
          Muro
        </button>
        <button
          type="button"
          onClick={() => {
            setFondamentale('attacco');
            setPasso('giocatore');
          }}
          className="rounded-xl bg-blue-700 px-8 py-5 text-xl font-semibold text-white"
        >
          Attacco
        </button>
      </div>
    );
  }

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
        onCompleta({ fondamentale, giocatoreId: giocatoreId!, valutazione: valutazione!, zona: zona!, direzione });
      }}
    />
  );
}
