import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { derivaValutazioneRicezione } from '@/domain/valutazioneAutomatica';

export interface DatiRicezione {
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
}

type Passo = 'giocatore' | 'origine';

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
  const [origine, setOrigine] = useState<Punto | null>(null);

  const controlli = (
    <p className="text-sm text-slate-400">
      Tocca il campo per registrare {passo === 'giocatore' ? 'il giocatore' : 'dove riceve'}.
    </p>
  );

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraRicevente,
        onSeleziona: (id: string) => {
          setGiocatoreId(id);
          setPasso('origine');
        },
      };
    }
    if (passo === 'origine') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => {
          setOrigine(p);
          onCompleta({
            giocatoreId: giocatoreId!,
            valutazione: derivaValutazioneRicezione(squadraRicevente, p),
            origine: p,
          });
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
        origineSelezionata={origine}
        ultimaTraiettoria={ultimaTraiettoria}
      />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
