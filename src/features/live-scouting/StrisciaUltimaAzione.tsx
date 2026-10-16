import type { Azione, Valutazione } from '@/domain/types';

const TUTTE_LE_VALUTAZIONI: Valutazione[] = ['#', '+', '!', '-', '/', '='];

export function StrisciaUltimaAzione({
  azione,
  etichettaGiocatore,
  onCorreggi,
}: {
  azione: Azione;
  // Numero e nome (es. "#7 Verdi"): l'id del giocatore non va mai mostrato.
  etichettaGiocatore?: string;
  onCorreggi: (valutazione: Valutazione) => void;
}) {
  const alternative = TUTTE_LE_VALUTAZIONI.filter((v) => v !== azione.valutazione);

  return (
    <div
      data-testid="striscia-ultima-azione"
      className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800 px-3 py-2 text-sm text-white"
    >
      <span className="text-slate-300">
        {azione.fondamentale}
        {etichettaGiocatore ? ` ${etichettaGiocatore}` : ''}: <strong>{azione.valutazione}</strong>
      </span>
      <div className="flex gap-1">
        {alternative.map((v) => (
          <button
            key={v}
            type="button"
            data-testid={`correggi-valutazione-${v}`}
            onClick={() => onCorreggi(v)}
            className="h-8 w-8 rounded-full bg-slate-700 text-sm font-bold text-white active:bg-slate-500"
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
