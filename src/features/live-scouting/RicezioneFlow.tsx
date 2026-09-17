import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiRicezione {
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
}

type Passo = 'giocatore' | 'valutazione' | 'origine' | 'destinazione';

export function RicezioneFlow({
  inCampoA,
  inCampoB,
  squadraRicevente,
  ultimaTraiettoria,
  onCompleta,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  squadraRicevente: Squadra;
  ultimaTraiettoria?: Traiettoria | null;
  onCompleta: (dati: DatiRicezione) => void;
}) {
  const [passo, setPasso] = useState<Passo>('giocatore');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);

  const controlli =
    passo === 'valutazione' ? (
      <ValutazioneButtons
        onSeleziona={(v) => {
          setValutazione(v);
          setPasso('origine');
        }}
      />
    ) : (
      <p className="text-sm text-slate-400">
        Tocca il campo per registrare {passo === 'giocatore' ? 'il giocatore' : passo === 'origine' ? "l'origine" : 'la destinazione'}.
      </p>
    );

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraRicevente,
        onSeleziona: (id: string) => {
          setGiocatoreId(id);
          setPasso('valutazione');
        },
      };
    }
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
          onCompleta({ giocatoreId: giocatoreId!, valutazione: valutazione!, origine: origine!, destinazione: p }),
      };
    }
    return { tipo: 'inattivo' as const };
  })();

  return (
    <div className="flex flex-col gap-4">
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
