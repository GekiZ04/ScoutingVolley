import { useState } from 'react';
import { CampoDaGioco } from '@/components/CampoDaGioco';
import { attacchiInRotazione, type DatiSetRotazioni, type FiltroRotazione } from '@/domain/rotazioni';
import { classificaEsitoAttacco, traiettoriaDaFreccia } from '@/domain/analysis';
import type { Player, Squadra } from '@/domain/types';

type Zona = 1 | 2 | 3 | 4 | 5 | 6;
const ZONE: Zona[] = [1, 2, 3, 4, 5, 6];
const FILTRI: { valore: FiltroRotazione; etichetta: string }[] = [
  { valore: 'dopoRicezione', etichetta: 'Att dopo Ric' },
  { valore: 'dopoRicezionePositiva', etichetta: 'Att dopo Ric positiva' },
  { valore: 'contrattacco', etichetta: 'Contrattacco' },
];

export function VistaRotazione({
  squadra,
  nomeSquadra,
  giocatori,
  dati,
  zonaIniziale,
  onChiudi,
  onCambiaSquadra,
}: {
  squadra: Squadra;
  nomeSquadra: string;
  giocatori: Player[];
  dati: DatiSetRotazioni[];
  zonaIniziale: Zona;
  onChiudi: () => void;
  // Se presente (nessuna squadra di riferimento) mostra il selettore A/B.
  onCambiaSquadra?: (squadra: Squadra) => void;
}) {
  const [zona, setZona] = useState<Zona>(zonaIniziale);
  const [filtro, setFiltro] = useState<FiltroRotazione>('dopoRicezione');

  const { attacchi, rotazioneUltima } = attacchiInRotazione({ dati, squadra, zona, filtro });
  const traiettorie = attacchi
    .filter((a) => a.origine && a.destinazione)
    .map((a) =>
      traiettoriaDaFreccia({
        origine: a.origine!,
        destinazione: a.destinazione!,
        esito: classificaEsitoAttacco(a.valutazione),
        toccoMuro: a.toccoMuro,
      }),
    );
  const inCampo = (rotazioneUltima ?? [])
    .map((id) => giocatori.find((g) => g.id === id))
    .filter((g): g is Player => g !== undefined);

  return (
    <div className="fixed inset-0 z-40 flex flex-col gap-2 bg-slate-950 p-3 text-white" data-testid="vista-rotazione">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">
          {nomeSquadra} – P{zona}
        </h2>
        <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2 font-semibold">
          Finito
        </button>
      </div>
      {onCambiaSquadra && (
        <div className="flex gap-1">
          {(['A', 'B'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onCambiaSquadra(s)}
              aria-pressed={s === squadra}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${s === squadra ? 'bg-blue-700' : 'bg-slate-800'}`}
            >
              Squadra {s}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {FILTRI.map((f) => (
          <button
            key={f.valore}
            type="button"
            onClick={() => setFiltro(f.valore)}
            aria-pressed={f.valore === filtro}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${f.valore === filtro ? 'bg-emerald-600' : 'bg-slate-800'}`}
          >
            {f.etichetta}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 gap-2">
        <div className="min-h-0 flex-1">
          <CampoDaGioco
            inCampoA={squadra === 'A' ? inCampo : []}
            inCampoB={squadra === 'B' ? inCampo : []}
            modalita={{ tipo: 'inattivo' }}
            traiettorieExtra={traiettorie}
          />
        </div>
        <div className="flex flex-col gap-1">
          {ZONE.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZona(z)}
              aria-pressed={z === zona}
              className={`rounded-lg px-3 py-2 text-sm font-semibold ${z === zona ? 'bg-emerald-600' : 'bg-slate-800'}`}
            >
              P{z}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-400">{traiettorie.length} attacchi</p>
    </div>
  );
}
