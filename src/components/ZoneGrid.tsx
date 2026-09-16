interface ZoneGridProps {
  variante: 'origine' | 'destinazione';
  onSeleziona: (zona: number) => void;
}

const CELLE_ORIGINE: number[][] = [
  [4, 3, 2],
  [5, 6, 1],
];

const CELLE_DESTINAZIONE: number[][] = [
  [7, 8, 9],
  [4, 3, 2],
  [5, 6, 1],
];

export function ZoneGrid({ variante, onSeleziona }: ZoneGridProps) {
  const righe = variante === 'origine' ? CELLE_ORIGINE : CELLE_DESTINAZIONE;
  return (
    <div className="flex flex-col gap-2" data-testid="zone-grid">
      {righe.map((riga, i) => (
        <div key={i} className="grid grid-cols-3 gap-2">
          {riga.map((zona) => (
            <button
              key={zona}
              type="button"
              onClick={() => onSeleziona(zona)}
              className="aspect-square rounded-xl bg-slate-700 text-2xl font-bold text-white active:bg-slate-500"
            >
              {zona}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
