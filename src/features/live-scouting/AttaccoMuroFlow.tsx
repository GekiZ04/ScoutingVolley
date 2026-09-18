import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

export interface DatiAttaccoMuro {
  fondamentale: 'attacco' | 'muro';
  squadra: Squadra;
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
  toccoMuro: boolean;
}

export interface DatiTocco {
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
}

type Passo =
  | 'bivio'
  | 'giocatore'
  | 'origine'
  | 'destinazione'
  | 'rimbalzo-muro'
  | 'tocco-giocatore'
  | 'tocco-valutazione'
  | 'valutazione';

export function AttaccoMuroFlow({
  mostraBivio,
  inCampoA,
  inCampoB,
  ultimaTraiettoria,
  onCompleta,
}: {
  mostraBivio: boolean;
  inCampoA: Player[];
  inCampoB: Player[];
  ultimaTraiettoria?: Traiettoria | null;
  onCompleta: (dati: DatiAttaccoMuro, tocco?: DatiTocco) => void;
}) {
  const [passo, setPasso] = useState<Passo>(mostraBivio ? 'bivio' : 'giocatore');
  const [fondamentale, setFondamentale] = useState<'attacco' | 'muro'>('attacco');
  const [squadra, setSquadra] = useState<Squadra | null>(null);
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);
  const [destinazione, setDestinazione] = useState<Punto | null>(null);
  const [toccoOrigine, setToccoOrigine] = useState<Punto | null>(null);
  const [toccoGiocatoreId, setToccoGiocatoreId] = useState<string | null>(null);
  const [toccoValutazione, setToccoValutazione] = useState<Valutazione | null>(null);

  const squadraBloccante: Squadra | null = squadra === 'A' ? 'B' : squadra === 'B' ? 'A' : null;

  function completaConValutazione(valutazioneFinale: Valutazione) {
    const dati: DatiAttaccoMuro = {
      fondamentale,
      squadra: squadra!,
      giocatoreId: giocatoreId!,
      valutazione: valutazioneFinale,
      origine: origine!,
      destinazione: destinazione!,
      toccoMuro: toccoOrigine !== null,
    };
    if (toccoOrigine !== null) {
      onCompleta(dati, { giocatoreId: toccoGiocatoreId!, valutazione: toccoValutazione!, origine: toccoOrigine });
    } else {
      onCompleta(dati);
    }
  }

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
    if (passo === 'tocco-valutazione') {
      return (
        <ValutazioneButtons
          onSeleziona={(v) => {
            setToccoValutazione(v);
            setPasso('valutazione');
          }}
        />
      );
    }
    if (passo === 'valutazione') {
      return <ValutazioneButtons onSeleziona={(v) => completaConValutazione(v)} />;
    }
    const etichetta =
      passo === 'giocatore'
        ? 'il giocatore (di entrambe le squadre)'
        : passo === 'origine'
          ? "l'origine"
          : passo === 'rimbalzo-muro'
            ? 'il punto di rimbalzo dopo il tocco'
            : passo === 'tocco-giocatore'
              ? 'il giocatore di prima linea che ha toccato'
              : 'la destinazione';
    return <p className="text-sm text-slate-400">Tocca il campo per registrare {etichetta}.</p>;
  })();

  const modalita = (() => {
    if (passo === 'giocatore') {
      return {
        tipo: 'seleziona-giocatore-entrambe' as const,
        onSeleziona: (id: string, sq: Squadra) => {
          setGiocatoreId(id);
          setSquadra(sq);
          setPasso('origine');
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
        squadraAttaccante: squadra!,
        onSelezionaPunto: (p: Punto) => {
          setDestinazione(p);
          setPasso('valutazione');
        },
        onSelezionaMuro: (p: Punto) => {
          setToccoOrigine(p);
          setPasso('rimbalzo-muro');
        },
      };
    }
    if (passo === 'destinazione' || passo === 'rimbalzo-muro') {
      const eraTocco = passo === 'rimbalzo-muro';
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => {
          setDestinazione(p);
          setPasso(eraTocco ? 'tocco-giocatore' : 'valutazione');
        },
      };
    }
    if (passo === 'tocco-giocatore' && squadraBloccante) {
      return {
        tipo: 'seleziona-giocatore-prima-linea' as const,
        squadraAttiva: squadraBloccante,
        onSeleziona: (id: string) => {
          setToccoGiocatoreId(id);
          setPasso('tocco-valutazione');
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
        destinazioneSelezionata={destinazione}
        ultimaTraiettoria={ultimaTraiettoria}
      />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
