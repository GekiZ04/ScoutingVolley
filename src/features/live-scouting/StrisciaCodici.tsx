import { useLayoutEffect, useRef } from 'react';
import type { CodiceStriscia } from '@/domain/codiciDataVolley';

// Stessi colori di CampoDaGioco; punto e fine set in nero.
const COLORE = { A: '#2563eb', B: '#f97316' } as const;

function colore(c: CodiceStriscia): string {
  return c.squadra ? COLORE[c.squadra] : '#000000';
}

function Codice({ codice }: { codice: CodiceStriscia }) {
  return (
    <span data-testid="codice" className="shrink-0 font-mono text-sm font-bold" style={{ color: colore(codice) }}>
      {codice.testo}
    </span>
  );
}

export function StrisciaCodici({
  codici,
  evidenziati,
  onAnnulla,
  disabilitato,
}: {
  codici: CodiceStriscia[];
  evidenziati: string[]; // chiavi dei codici che Annulla toglie
  onAnnulla: () => void;
  disabilitato: boolean;
}) {
  const scorrevole = useRef<HTMLDivElement>(null);
  const ultimaChiave = codici[codici.length - 1]?.chiave;

  // Quando arriva un codice nuovo si torna sempre in fondo.
  useLayoutEffect(() => {
    const el = scorrevole.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [ultimaChiave]);

  function pagina(verso: -1 | 1) {
    const el = scorrevole.current;
    if (el) el.scrollLeft += verso * el.clientWidth;
  }

  // Gli evidenziati sono la coda dei codici: l'ordine cronologico resta.
  const sciolti = codici.filter((c) => !evidenziati.includes(c.chiave));
  const uniti = codici.filter((c) => evidenziati.includes(c.chiave));

  return (
    <div
      data-testid="striscia-codici"
      className="mt-2 flex shrink-0 items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-black"
    >
      <button
        type="button"
        aria-label="Codici precedenti"
        onClick={() => pagina(-1)}
        className="shrink-0 rounded bg-slate-200 px-2 py-1 text-sm font-bold"
      >
        «
      </button>
      <div ref={scorrevole} data-testid="codici-scorrevoli" className="flex min-w-0 flex-1 gap-3 overflow-hidden whitespace-nowrap">
        {sciolti.map((c) => (
          <Codice key={c.chiave} codice={c} />
        ))}
      </div>
      <button
        type="button"
        aria-label="Codici successivi"
        onClick={() => pagina(1)}
        className="shrink-0 rounded bg-slate-200 px-2 py-1 text-sm font-bold"
      >
        »
      </button>
      <div className="flex shrink-0 items-center overflow-hidden rounded-lg border-2 border-red-700">
        <div data-testid="codici-evidenziati" className="flex gap-3 bg-red-50 px-2 py-1">
          {uniti.map((c) => (
            <Codice key={c.chiave} codice={c} />
          ))}
        </div>
        <button
          type="button"
          onClick={onAnnulla}
          disabled={disabilitato}
          className="self-stretch bg-red-700 px-4 py-1 text-sm font-semibold text-white disabled:opacity-40"
        >
          Annulla
        </button>
      </div>
    </div>
  );
}
