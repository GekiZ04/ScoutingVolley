const ORDINE: (1 | 2 | 3 | 4 | 5 | 6)[] = [1, 6, 5, 4, 3, 2];

export function ColonnaRotazioni({
  attuale,
  onApri,
}: {
  attuale: 1 | 2 | 3 | 4 | 5 | 6 | null;
  onApri: (zona: 1 | 2 | 3 | 4 | 5 | 6) => void;
}) {
  if (attuale === null) return null;
  return (
    <aside className="flex flex-col gap-1" data-testid="colonna-rotazioni" aria-label="Rotazioni">
      {ORDINE.map((zona) => (
        <button
          key={zona}
          type="button"
          onClick={() => onApri(zona)}
          aria-current={zona === attuale ? 'true' : undefined}
          className={`rounded-lg px-2 py-2 text-sm font-semibold ${
            zona === attuale ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-300'
          }`}
        >
          P{zona}
        </button>
      ))}
    </aside>
  );
}
