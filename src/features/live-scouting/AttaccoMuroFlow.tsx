import { useState } from 'react';
import type { Player, Squadra, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { derivaValutazioneMuroDaAttacco } from '@/domain/valutazioneAutomatica';

export interface DatiAttaccoMuro {
  fondamentale: 'attacco';
  squadra: Squadra;
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
  toccoMuro: boolean;
}

export interface DatiTocco {
  valutazione: Valutazione;
  origine: Punto;
}

// 'fatto' e' un passo terminale inerte: l'azione e' stata consegnata al parent,
// che la salva in modo asincrono e poi rimonta il flusso. Senza questo passo il
// campo resterebbe tappabile durante l'attesa e un secondo tap registrerebbe
// un'azione duplicata.
type Passo = 'giocatore' | 'origine' | 'destinazione' | 'fatto';

// Valutazione di default per un attacco appena registrato: non si puo' dedurre
// dalla sola geometria (a differenza della ricezione) se e' stato un punto, un
// errore o una difesa avversaria; lo scout la corregge dopo, dalla striscia
// dell'ultima azione, in base a come e' proseguito davvero il rally.
const VALUTAZIONE_DEFAULT: Valutazione = '+';

/**
 * Attacco (ed eventuale contrattacco): il muro non e' mai una scelta a parte
 * dello scout. Se tocca la zona rossa a rete, l'attacco si registra comunque
 * (stesso singolo tap = destinazione, toccoMuro true) e viene consegnato
 * insieme un tocco muro derivato automaticamente dalla valutazione
 * dell'attacco (vedi derivaValutazioneMuroDaAttacco): lo scout corregge in
 * seguito solo l'attacco, il muro si ricalcola da solo di conseguenza (vedi
 * liveMatchStore.correggiValutazione).
 */
export function AttaccoMuroFlow({
  inCampoA,
  inCampoB,
  ultimaTraiettoria,
  onCompleta,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  ultimaTraiettoria?: Traiettoria | null;
  onCompleta: (dati: DatiAttaccoMuro, tocco?: DatiTocco) => void;
}) {
  const [passo, setPasso] = useState<Passo>('giocatore');
  const [squadra, setSquadra] = useState<Squadra | null>(null);
  const [giocatoreId, setGiocatoreId] = useState<string | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);
  const [destinazione, setDestinazione] = useState<Punto | null>(null);

  function completa(puntoDestinazione: Punto, toccoMuro: boolean) {
    // Spegne il campo prima di consegnare l'azione al parent: da qui in poi
    // ogni tap ulteriore sarebbe un duplicato (vedi commento su 'fatto').
    setPasso('fatto');
    setDestinazione(puntoDestinazione);

    const dati: DatiAttaccoMuro = {
      fondamentale: 'attacco',
      squadra: squadra!,
      giocatoreId: giocatoreId!,
      valutazione: VALUTAZIONE_DEFAULT,
      origine: origine!,
      destinazione: puntoDestinazione,
      toccoMuro,
    };
    if (toccoMuro) {
      onCompleta(dati, {
        valutazione: derivaValutazioneMuroDaAttacco(VALUTAZIONE_DEFAULT),
        origine: puntoDestinazione,
      });
    } else {
      onCompleta(dati);
    }
  }

  const controlli = (() => {
    if (passo === 'fatto') {
      return <p className="text-sm text-slate-400">Azione registrata.</p>;
    }
    const etichetta =
      passo === 'giocatore' ? 'il giocatore (di entrambe le squadre)' : passo === 'origine' ? "l'origine" : 'la destinazione (zona rossa = tocco muro)';
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
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto-con-fascia-muro' as const,
        squadraAttaccante: squadra!,
        onSelezionaPunto: (p: Punto) => completa(p, false),
        onSelezionaMuro: (p: Punto) => completa(p, true),
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
