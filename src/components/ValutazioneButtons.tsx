import type { Valutazione } from '@/domain/types';

const VALUTAZIONI: Valutazione[] = ['#', '+', '!', '-', '='];

export function ValutazioneButtons({ onSeleziona }: { onSeleziona: (v: Valutazione) => void }) {
  return (
    <div className="flex gap-3">
      {VALUTAZIONI.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSeleziona(v)}
          className="h-16 w-16 rounded-full bg-slate-700 text-2xl font-bold text-white active:bg-slate-500"
        >
          {v}
        </button>
      ))}
    </div>
  );
}
