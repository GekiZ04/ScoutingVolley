import { useState } from 'react';
import type { ZonaAttacco } from '@/domain/analisiAttacco';
import {
  COLONNE_DISTRIBUZIONE,
  ROTAZIONI_CLICK,
  distribuzionePerRotazione,
  efficienza,
  kill,
  riepilogoCambioPalla,
  type DatiSetDistribuzione,
  type EsitoAttacchi,
  type FiltroRotazioni,
} from '@/domain/distribuzionePalleggio';
import type { Squadra } from '@/domain/types';

const FILTRI: { valore: FiltroRotazioni; etichetta: string }[] = [
  ...COLONNE_DISTRIBUZIONE.map((c) => ({ valore: c.chiave as FiltroRotazioni, etichetta: c.etichetta })),
  { valore: 'contrattacco', etichetta: 'Contrattacco' },
];

// Campetto visto da dietro la squadra che attacca, rete in alto: prima linea
// 4-3-2 (fascia dei 3 metri), seconda linea 5-6-1.
const LATO = 150;
const TRE_METRI = LATO / 3;
const COLONNA: Record<ZonaAttacco, number> = { 4: 0, 3: 1, 2: 2, 5: 0, 6: 1, 1: 2 };
const PRIMA_LINEA = new Set<ZonaAttacco>([4, 3, 2]);

function Campetto({ celle }: { celle: Map<ZonaAttacco, EsitoAttacchi> }) {
  const totale = [...celle.values()].reduce((s, e) => s + e.tot, 0);
  const larghezza = LATO / 3;
  return (
    <svg viewBox={`0 0 ${LATO} ${LATO}`} className="h-auto w-full" role="img">
      <rect x={0.5} y={0.5} width={LATO - 1} height={LATO - 1} fill="white" stroke="black" />
      <line x1={0} x2={LATO} y1={TRE_METRI} y2={TRE_METRI} stroke="black" />
      {[1, 2].map((i) => (
        <line key={i} x1={i * larghezza} x2={i * larghezza} y1={0} y2={LATO} stroke="#999" strokeDasharray="3 3" />
      ))}
      {[...celle.entries()].map(([zona, e]) => {
        const x = COLONNA[zona] * larghezza;
        const y = PRIMA_LINEA.has(zona) ? 0 : TRE_METRI;
        const quota = totale ? e.tot / totale : 0;
        const altezza = Math.max(3, quota * 34);
        return (
          <g key={zona} data-testid={`zona-${zona}`}>
            <text x={x + larghezza / 2} y={y + 9} textAnchor="middle" fontSize={8} fontWeight={700}>
              {e.tot} · {efficienza(e)} · {kill(e)}
            </text>
            <rect x={x + 5} y={y + 12} width={larghezza - 10} height={altezza} fill="#9ca3af" stroke="black" strokeWidth={0.6} />
          </g>
        );
      })}
    </svg>
  );
}

export function DistribuzioneRotazioni({
  nomi,
  dati,
}: {
  nomi: Record<Squadra, string>;
  dati: DatiSetDistribuzione[];
}) {
  const [squadra, setSquadra] = useState<Squadra>('A');
  const [filtro, setFiltro] = useState<FiltroRotazioni>('ricPositiva');
  const celle = distribuzionePerRotazione(dati, squadra, filtro);
  const senzaPalleggiatore = dati.every(({ set }) => !(squadra === 'A' ? set.paleggiatoreIdA : set.paleggiatoreIdB));
  const bottone = (attivo: boolean) =>
    `border border-black px-2 py-0.5 text-xs font-semibold ${attivo ? 'bg-black text-white' : 'bg-white'}`;

  return (
    <section className="mb-8 break-inside-avoid" data-testid="distribuzione-rotazioni">
      <h2 className="mb-1 text-lg font-bold">Distribuzione per rotazione</h2>
      <div className="mb-2 flex flex-wrap gap-1 print:hidden">
        {(['A', 'B'] as const).map((s) => (
          <button key={s} type="button" aria-pressed={s === squadra} className={bottone(s === squadra)} onClick={() => setSquadra(s)}>
            {nomi[s]}
          </button>
        ))}
        <span className="mx-1" />
        {FILTRI.map((f) => (
          <button
            key={f.valore}
            type="button"
            aria-pressed={f.valore === filtro}
            className={bottone(f.valore === filtro)}
            onClick={() => setFiltro(f.valore)}
          >
            {f.etichetta}
          </button>
        ))}
      </div>
      <p className="mb-2 text-[11px]">
        {nomi[squadra]} · {FILTRI.find((f) => f.valore === filtro)?.etichetta}. Per ogni zona: totale attacchi · efficienza %
        (# − / − =) · attacchi punto %. Il rettangolo è la quota degli attacchi della rotazione.
      </p>
      {senzaPalleggiatore ? (
        <p className="text-xs">Manca il palleggiatore nella formazione dei set: le rotazioni non sono calcolabili.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {ROTAZIONI_CLICK.map((r) => {
            const perZona = celle.get(r)!;
            const tot = [...perZona.values()].reduce((s, e) => s + e.tot, 0);
            return (
              <div key={r} data-testid={`rotazione-P${r}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold">P{r}</span>
                  <span className="text-[11px]">{tot} att.</span>
                </div>
                <Campetto celle={perZona} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

const decimali = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 2 });
const ogni = (quanti: number, punti: number) => (punti ? decimali(quanti / punti) : '–');
const percento = (e: EsitoAttacchi) => (e.tot ? `${kill(e)}%` : '–');
const CELLA = 'px-2 py-0.5 text-center';

function Lato({ dati, squadra }: { dati: DatiSetDistribuzione[]; squadra: Squadra }) {
  const r = riepilogoCambioPalla(dati, squadra);
  return (
    <div className="flex gap-3 text-xs" data-testid={`cambio-palla-lato-${squadra}`}>
      <div className="min-w-[10rem] space-y-3">
        <div>
          <div>Ricezioni {r.ricezioni}</div>
          <div>Punti CP {r.puntiCambioPalla}</div>
          <div className="text-[11px]">Ogni {ogni(r.ricezioni, r.puntiCambioPalla)} ricezioni 1 punto</div>
        </div>
        <div className="border-t border-black pt-2">
          <div>Battute {r.battute}</div>
          <div>Punti BP {r.puntiBreak}</div>
          <div className="text-[11px]">Ogni {ogni(r.battute, r.puntiBreak)} battute 1 break point</div>
        </div>
      </div>
      {r.diffRotazione && (
        <table className="border border-black">
          <thead>
            <tr>
              <th className={CELLA}>Rot</th>
              <th className={CELLA}>Diff</th>
            </tr>
          </thead>
          <tbody>
            {([1, 2, 3, 4, 5, 6] as const).map((rot) => (
              <tr key={rot}>
                <td className={CELLA}>P{rot}</td>
                <td className={CELLA}>{r.diffRotazione![rot] > 0 ? `+${r.diffRotazione![rot]}` : r.diffRotazione![rot]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function CambioPallaRiquadro({ nomi, dati }: { nomi: Record<Squadra, string>; dati: DatiSetDistribuzione[] }) {
  const a = riepilogoCambioPalla(dati, 'A');
  const b = riepilogoCambioPalla(dati, 'B');
  const blocchi: { titolo: string; a: EsitoAttacchi; b: EsitoAttacchi }[] = [
    { titolo: '1° attacco dopo ricezione positiva (# +)', a: a.ricPositiva, b: b.ricPositiva },
    { titolo: '1° attacco dopo ricezione negativa (! - /)', a: a.ricNegativa, b: b.ricNegativa },
    { titolo: 'Contrattacco', a: a.contrattacco, b: b.contrattacco },
  ];
  return (
    <section className="mb-8 break-inside-avoid" data-testid="cambio-palla">
      <h2 className="mb-1 text-lg font-bold">Cambio palla e contrattacco</h2>
      <div className="flex flex-wrap items-start gap-4 border border-black p-3">
        <div>
          <div className="mb-2 font-bold">{nomi.A}</div>
          <Lato dati={dati} squadra="A" />
        </div>
        <table className="flex-1 border border-black text-xs">
          <tbody>
            {blocchi.map(({ titolo, a: ea, b: eb }) => (
              <FragmentBlocco key={titolo} titolo={titolo} a={ea} b={eb} />
            ))}
          </tbody>
        </table>
        <div>
          <div className="mb-2 text-right font-bold">{nomi.B}</div>
          <Lato dati={dati} squadra="B" />
        </div>
      </div>
      <p className="mt-1 text-[11px]">
        Punti % = attacchi punto (#) sul totale. Murati = /, Errori = =. Punti CP = rally vinti in ricezione, Punti BP = rally
        vinti al servizio. Diff = punti fatti meno subiti con il palleggiatore in quella rotazione.
      </p>
    </section>
  );
}

function FragmentBlocco({ titolo, a, b }: { titolo: string; a: EsitoAttacchi; b: EsitoAttacchi }) {
  return (
    <>
      <tr>
        <th colSpan={9} className="border-t border-black bg-stone-100 px-2 py-1 text-center font-semibold uppercase">
          {titolo}
        </th>
      </tr>
      <tr className="text-[11px]">
        {['Errori', 'Murati', 'Punti', 'Tot', '', 'Tot', 'Punti', 'Murati', 'Errori'].map((t, i) => (
          <th key={i} className={`${CELLA} font-normal ${i === 4 ? 'border-l border-black' : ''}`}>
            {t}
          </th>
        ))}
      </tr>
      <tr>
        <td className={CELLA}>{a.errori}</td>
        <td className={CELLA}>{a.murati}</td>
        <td className={`${CELLA} font-bold`}>{percento(a)}</td>
        <td className={CELLA}>{a.tot}</td>
        <td className="border-l border-black" />
        <td className={CELLA}>{b.tot}</td>
        <td className={`${CELLA} font-bold`}>{percento(b)}</td>
        <td className={CELLA}>{b.murati}</td>
        <td className={CELLA}>{b.errori}</td>
      </tr>
    </>
  );
}
