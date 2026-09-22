import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { derivaValutazioneMuro, derivaValutazioneAttaccoCerta } from '@/domain/valutazioneAutomatica';

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
  | 'tocco-giocatore';

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

  const squadraBloccante: Squadra | null = squadra === 'A' ? 'B' : squadra === 'B' ? 'A' : null;

  function completa(puntoDestinazione: Punto, puntoTocco: Punto | null, giocatoreToccoId: string | null) {
    const valutazioneMuroTocco = puntoTocco !== null
      ? (derivaValutazioneMuro(squadraBloccante!, puntoDestinazione) ?? '+')
      : null;
    const valutazioneFinale = fondamentale === 'muro'
      ? (derivaValutazioneMuro(squadra!, puntoDestinazione) ?? '+')
      : (derivaValutazioneAttaccoCerta(puntoTocco !== null, valutazioneMuroTocco) ?? '+');

    const dati: DatiAttaccoMuro = {
      fondamentale,
      squadra: squadra!,
      giocatoreId: giocatoreId!,
      valutazione: valutazioneFinale,
      origine: origine!,
      destinazione: puntoDestinazione,
      toccoMuro: puntoTocco !== null,
    };
    if (puntoTocco !== null) {
      onCompleta(dati, { giocatoreId: giocatoreToccoId!, valutazione: valutazioneMuroTocco!, origine: puntoTocco });
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
          completa(p, null, null);
        },
        onSelezionaMuro: (p: Punto) => {
          setToccoOrigine(p);
          setPasso('rimbalzo-muro');
        },
      };
    }
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => {
          setDestinazione(p);
          completa(p, null, null);
        },
      };
    }
    if (passo === 'rimbalzo-muro') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => {
          setDestinazione(p);
          setPasso('tocco-giocatore');
        },
      };
    }
    if (passo === 'tocco-giocatore' && squadraBloccante) {
      return {
        tipo: 'seleziona-giocatore-prima-linea' as const,
        squadraAttiva: squadraBloccante,
        onSeleziona: (id: string) => {
          completa(destinazione!, toccoOrigine!, id);
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
