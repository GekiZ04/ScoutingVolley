import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiAttaccoMuro {
  fondamentale: 'attacco' | 'muro';
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
  toccoMuro: boolean;
}

type Passo = 'bivio' | 'giocatore' | 'valutazione' | 'origine' | 'destinazione' | 'rimbalzo-muro';

export function AttaccoMuroFlow({
  mostraBivio,
  inCampoA,
  inCampoB,
  squadraProtagonista,
  ultimaTraiettoria,
  onCompleta,
}: {
  mostraBivio: boolean;
  inCampoA: Player[];
  inCampoB: Player[];
  squadraProtagonista: Squadra;
  ultimaTraiettoria?: Traiettoria | null;
  onCompleta: (dati: DatiAttaccoMuro) => void;
}) {
  const [passo, setPasso] = useState<Passo>(mostraBivio ? 'bivio' : 'giocatore');
  const [fondamentale, setFondamentale] = useState<'attacco' | 'muro'>('attacco');
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [valutazione, setValutazione] = useState<Valutazione | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);

  const controlli = (() => {
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
    const etichetta =
      passo === 'giocatore'
        ? 'il giocatore'
        : passo === 'origine'
          ? "l'origine"
          : passo === 'rimbalzo-muro'
            ? 'il punto di rimbalzo dopo il tocco'
            : 'la destinazione';
    return <p className="text-sm text-slate-400">Tocca il campo per registrare {etichetta}.</p>;
  })();

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraProtagonista,
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
    if (passo === 'destinazione' && fondamentale === 'attacco') {
      return {
        tipo: 'seleziona-punto-con-fascia-muro' as const,
        squadraAttaccante: squadraProtagonista,
        onSelezionaPunto: (p: Punto) =>
          onCompleta({
            fondamentale,
            giocatoreId: giocatoreId!,
            valutazione: valutazione!,
            origine: origine!,
            destinazione: p,
            toccoMuro: false,
          }),
        onSelezionaMuro: () => setPasso('rimbalzo-muro'),
      };
    }
    if (passo === 'destinazione' || passo === 'rimbalzo-muro') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) =>
          onCompleta({
            fondamentale,
            giocatoreId: giocatoreId!,
            valutazione: valutazione!,
            origine: origine!,
            destinazione: p,
            toccoMuro: passo === 'rimbalzo-muro',
          }),
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
