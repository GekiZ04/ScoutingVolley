import { useState } from 'react';
import type { Player, Squadra, TipoBattuta, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import {
  derivaValutazioneRicezione,
  derivaValutazioneBattutaDaRicezione,
} from '@/domain/valutazioneAutomatica';

export interface DatiBattuta {
  tipoBattuta: TipoBattuta;
  valutazione: Valutazione;
  origine: Punto;
  destinazione: Punto;
}

export interface DatiRicezioneDaBattuta {
  giocatoreId: string;
  valutazione: Valutazione;
  origine: Punto;
}

// La tabella di derivazione battuta<-ricezione vive in domain/valutazioneAutomatica.ts
// perche' serve anche alla correzione post-hoc nello store (liveMatchStore).

// 'fatto' e' un passo terminale inerte: l'azione e' stata consegnata al parent,
// che la salva in modo asincrono e poi rimonta il flusso. Senza questo passo il
// campo resterebbe tappabile durante l'attesa e un secondo tap registrerebbe
// un'azione duplicata.
type Passo = 'tipo' | 'origine' | 'destinazione' | 'esito' | 'ricezione-origine' | 'fatto';

const TIPI_BATTUTA: { valore: TipoBattuta; etichetta: string }[] = [
  { valore: 'flottante', etichetta: 'Flottante' },
  { valore: 'salto_flottante', etichetta: 'Salto flottante' },
  { valore: 'salto_spin', etichetta: 'Salto spin' },
];

export function BattutaFlow({
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
  onCompleta: (dati: DatiBattuta, ricezione?: DatiRicezioneDaBattuta) => void;
}) {
  const [passo, setPasso] = useState<Passo>('tipo');
  const [tipoBattuta, setTipoBattuta] = useState<TipoBattuta | null>(null);
  const [origine, setOrigine] = useState<Punto | null>(null);
  const [destinazione, setDestinazione] = useState<Punto | null>(null);
  const [riceGiocatoreId, setRiceGiocatoreId] = useState<string | null>(null);
  const [riceOrigine, setRiceOrigine] = useState<Punto | null>(null);

  function completaConEsitoDiretto(valutazione: Valutazione) {
    setPasso('fatto');
    onCompleta({ tipoBattuta: tipoBattuta!, valutazione, origine: origine!, destinazione: destinazione! });
  }

  function completaConRicezione(valutazioneRicezione: Valutazione, origineRicezione: Punto) {
    setPasso('fatto');
    const valutazioneBattuta = derivaValutazioneBattutaDaRicezione(valutazioneRicezione);
    onCompleta(
      { tipoBattuta: tipoBattuta!, valutazione: valutazioneBattuta, origine: origine!, destinazione: destinazione! },
      { giocatoreId: riceGiocatoreId!, valutazione: valutazioneRicezione, origine: origineRicezione },
    );
  }

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
                setPasso('origine');
              }}
              className="rounded-xl bg-blue-700 px-6 py-4 text-lg font-semibold text-white"
            >
              {tipo.etichetta}
            </button>
          ))}
        </div>
      );
    }
    if (passo === 'esito') {
      return (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-400">
            Ace o errore diretto, oppure tocca sul campo chi riceve.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => completaConEsitoDiretto('#')}
              className="rounded-xl bg-emerald-700 px-8 py-5 text-xl font-semibold text-white"
            >
              Ace #
            </button>
            <button
              type="button"
              onClick={() => completaConEsitoDiretto('=')}
              className="rounded-xl bg-red-800 px-8 py-5 text-xl font-semibold text-white"
            >
              Errore =
            </button>
          </div>
        </div>
      );
    }
    if (passo === 'fatto') {
      return <p className="text-sm text-slate-400">Azione registrata.</p>;
    }
    const etichetta =
      passo === 'origine'
        ? "l'origine"
        : passo === 'destinazione'
          ? 'la destinazione'
          : 'dove riceve';
    return <p className="text-sm text-slate-400">Tocca il campo per registrare {etichetta}.</p>;
  })();

  const modalita = (() => {
    if (passo === 'origine') {
      return { tipo: 'seleziona-punto' as const, onSeleziona: (p: Punto) => { setOrigine(p); setPasso('destinazione'); } };
    }
    if (passo === 'destinazione') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => { setDestinazione(p); setPasso('esito'); },
      };
    }
    if (passo === 'esito') {
      return {
        tipo: 'seleziona-giocatore' as const,
        squadraAttiva: squadraRicevente,
        onSeleziona: (id: string) => { setRiceGiocatoreId(id); setPasso('ricezione-origine'); },
      };
    }
    if (passo === 'ricezione-origine') {
      return {
        tipo: 'seleziona-punto' as const,
        onSeleziona: (p: Punto) => {
          setRiceOrigine(p);
          completaConRicezione(derivaValutazioneRicezione(squadraRicevente, p), p);
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
        origineSelezionata={passo === 'ricezione-origine' ? riceOrigine : origine}
        destinazioneSelezionata={passo === 'esito' ? destinazione : null}
        ultimaTraiettoria={ultimaTraiettoria}
      />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
