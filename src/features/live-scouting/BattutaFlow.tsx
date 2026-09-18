import { useState } from 'react';
import type { Player, Squadra, TipoBattuta, Valutazione, Punto } from '@/domain/types';
import { CampoDaGioco, type Traiettoria } from '@/components/CampoDaGioco';
import { ValutazioneButtons } from '@/components/ValutazioneButtons';

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

// Se lo scout non segna direttamente ace (#) o errore (=) sulla battuta, ma
// registra invece la ricezione avversaria, la valutazione della battuta si
// deriva da quella della ricezione (scala invertita: ricezione forte -> battuta
// debole). '=' non compare qui perche' una ricezione '=' chiude gia' il rally
// da sola (vedi domain/reducer.ts) senza bisogno di derivare nulla sul lato battuta.
const DERIVA_BATTUTA_DA_RICEZIONE: Partial<Record<Valutazione, Valutazione>> = {
  '#': '-',
  '+': '-',
  '!': '!',
  '-': '+',
};

type Passo = 'tipo' | 'origine' | 'destinazione' | 'esito' | 'ricezione-origine' | 'ricezione-valutazione';

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
    onCompleta({ tipoBattuta: tipoBattuta!, valutazione, origine: origine!, destinazione: destinazione! });
  }

  function completaConRicezione(valutazioneRicezione: Valutazione) {
    const valutazioneBattuta = DERIVA_BATTUTA_DA_RICEZIONE[valutazioneRicezione] ?? '+';
    onCompleta(
      { tipoBattuta: tipoBattuta!, valutazione: valutazioneBattuta, origine: origine!, destinazione: destinazione! },
      { giocatoreId: riceGiocatoreId!, valutazione: valutazioneRicezione, origine: riceOrigine! },
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
    if (passo === 'ricezione-valutazione') {
      return <ValutazioneButtons onSeleziona={(v) => completaConRicezione(v)} />;
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
        onSeleziona: (p: Punto) => { setRiceOrigine(p); setPasso('ricezione-valutazione'); },
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
        origineSelezionata={passo === 'ricezione-origine' || passo === 'ricezione-valutazione' ? riceOrigine : origine}
        destinazioneSelezionata={passo === 'esito' ? destinazione : null}
        ultimaTraiettoria={ultimaTraiettoria}
      />
      <div className="rounded-lg bg-slate-800 p-3">{controlli}</div>
    </div>
  );
}
