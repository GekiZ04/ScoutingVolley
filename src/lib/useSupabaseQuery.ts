import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Sostituisce dexie-react-hooks' useLiveQuery: riesegue queryFn al mount, ad
// ogni cambio di deps, e ad ogni evento realtime Postgres sulle tabelle
// indicate (granularita' per tabella, non per riga: piu' semplice e
// sufficiente per i volumi di questa app). Ritorna undefined finche' la
// prima query non e' risolta, come faceva useLiveQuery.
export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: unknown[],
  tabelleRealtime: string[],
): T | undefined {
  const [risultato, setRisultato] = useState<T | undefined>(undefined);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  useEffect(() => {
    let annullato = false;

    async function esegui() {
      const valore = await queryFnRef.current();
      if (!annullato) setRisultato(valore);
    }

    esegui();

    const canale = supabase.channel(`live-${tabelleRealtime.join('-')}-${Math.random().toString(36).slice(2)}`);
    for (const tabella of tabelleRealtime) {
      canale.on('postgres_changes', { event: '*', schema: 'public', table: tabella }, () => {
        esegui();
      });
    }
    canale.subscribe();

    return () => {
      annullato = true;
      supabase.removeChannel(canale);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return risultato;
}
