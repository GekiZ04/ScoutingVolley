// Client Supabase finto, in memoria, per i test — gioca lo stesso ruolo che
// fake-indexeddb aveva per Dexie. Copre solo il sottoinsieme di API
// realmente usato in src/db/*.ts e nei componenti (select/insert/update/
// upsert/delete con .eq()/.order()/.maybeSingle(), conteggio con
// {count:'exact', head:true}, e i metodi auth/channel usati da AuthGate e
// useSupabaseQuery). Non replica RLS ne' i vincoli SQL del vero schema.
type Riga = Record<string, unknown>;

const tabelle = new Map<string, Riga[]>();
const ascoltatori = new Map<string, Set<() => void>>();

function tabella(nome: string): Riga[] {
  if (!tabelle.has(nome)) tabelle.set(nome, []);
  return tabelle.get(nome)!;
}

// Simula gli eventi realtime postgres_changes di Supabase: notifica in modo
// sincrono chi si e' iscritto a una tabella con .channel(...).on(...) ogni
// volta che quella tabella viene scritta, cosi' useSupabaseQuery si aggiorna
// nei test esattamente come farebbe in produzione con Supabase Realtime.
function notifica(nomeTabella: string): void {
  for (const callback of ascoltatori.get(nomeTabella) ?? []) callback();
}

export function resetFakeSupabase(): void {
  tabelle.clear();
  ascoltatori.clear();
}

class FakeQueryBuilder implements PromiseLike<{ data: Riga[] | null; error: null; count: number | null }> {
  private filtriEq: [string, unknown][] = [];
  private colonnaOrdine: string | null = null;
  private ordineDiscendente = false;
  private modalitaConteggio = false;

  constructor(
    private nomeTabella: string,
    private operazione: 'select' | 'insert' | 'update' | 'upsert' | 'delete',
    private payload: Riga | Riga[] | null = null,
  ) {}

  select(_colonne?: string, opzioni?: { count?: string; head?: boolean }) {
    if (opzioni?.count) this.modalitaConteggio = true;
    return this;
  }

  eq(colonna: string, valore: unknown) {
    this.filtriEq.push([colonna, valore]);
    return this;
  }

  order(colonna: string, opzioni?: { ascending?: boolean }) {
    this.colonnaOrdine = colonna;
    this.ordineDiscendente = opzioni?.ascending === false;
    return this;
  }

  private righeFiltrate(): Riga[] {
    let righe = tabella(this.nomeTabella);
    for (const [colonna, valore] of this.filtriEq) {
      righe = righe.filter((r) => r[colonna] === valore);
    }
    if (this.colonnaOrdine) {
      const colonna = this.colonnaOrdine;
      righe = [...righe].sort((a, b) => {
        const av = a[colonna] as string | number;
        const bv = b[colonna] as string | number;
        if (av < bv) return this.ordineDiscendente ? 1 : -1;
        if (av > bv) return this.ordineDiscendente ? -1 : 1;
        return 0;
      });
    }
    return righe;
  }

  private esegui(): { data: Riga[] | null; error: null; count: number | null } {
    if (this.operazione === 'insert') {
      const righe = Array.isArray(this.payload) ? this.payload : [this.payload as Riga];
      tabella(this.nomeTabella).push(...righe);
      notifica(this.nomeTabella);
      return { data: righe, error: null, count: null };
    }
    if (this.operazione === 'upsert') {
      const riga = this.payload as Riga;
      const lista = tabella(this.nomeTabella);
      const indice = lista.findIndex((r) => r.id === riga.id);
      if (indice >= 0) lista[indice] = riga;
      else lista.push(riga);
      notifica(this.nomeTabella);
      return { data: [riga], error: null, count: null };
    }
    if (this.operazione === 'update') {
      const lista = this.righeFiltrate();
      for (const riga of lista) Object.assign(riga, this.payload as Riga);
      notifica(this.nomeTabella);
      return { data: lista, error: null, count: null };
    }
    if (this.operazione === 'delete') {
      const daRimuovere = new Set(this.righeFiltrate());
      const lista = tabella(this.nomeTabella);
      const rimaste = lista.filter((r) => !daRimuovere.has(r));
      tabelle.set(this.nomeTabella, rimaste);
      notifica(this.nomeTabella);
      return { data: null, error: null, count: null };
    }
    const righe = this.righeFiltrate();
    return { data: righe, error: null, count: this.modalitaConteggio ? righe.length : null };
  }

  maybeSingle() {
    const risultato = this.esegui();
    const prima = (risultato.data ?? [])[0] ?? null;
    return Promise.resolve({ data: prima, error: null });
  }

  then<TResult1 = { data: Riga[] | null; error: null; count: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: Riga[] | null; error: null; count: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.esegui()).then(onfulfilled, onrejected);
  }
}

const SESSIONE_FINTA = {
  access_token: 'fake-token',
  user: { id: 'utente-test', email: 'test@example.com' },
} as unknown;

// Simula supabase.channel(...).on('postgres_changes', {table}, cb).subscribe():
// registra cb in `ascoltatori` per tabella cosi' che le mutazioni di
// FakeQueryBuilder lo richiamino, e lo rimuove su removeChannel.
class FakeChannel {
  private callbackPerTabella = new Map<string, () => void>();

  on(_evento: string, filtro: { table: string }, callback: () => void) {
    this.callbackPerTabella.set(filtro.table, callback);
    return this;
  }

  subscribe() {
    for (const [nomeTabella, callback] of this.callbackPerTabella) {
      if (!ascoltatori.has(nomeTabella)) ascoltatori.set(nomeTabella, new Set());
      ascoltatori.get(nomeTabella)!.add(callback);
    }
    return this;
  }

  rimuovi() {
    for (const [nomeTabella, callback] of this.callbackPerTabella) {
      ascoltatori.get(nomeTabella)?.delete(callback);
    }
  }
}

export const fakeSupabase = {
  from(nomeTabella: string) {
    return {
      select: (colonne?: string, opzioni?: { count?: string; head?: boolean }) =>
        new FakeQueryBuilder(nomeTabella, 'select').select(colonne, opzioni),
      insert: (payload: Riga | Riga[]) => new FakeQueryBuilder(nomeTabella, 'insert', payload),
      update: (payload: Riga) => new FakeQueryBuilder(nomeTabella, 'update', payload),
      upsert: (payload: Riga) => new FakeQueryBuilder(nomeTabella, 'upsert', payload),
      delete: () => new FakeQueryBuilder(nomeTabella, 'delete'),
    };
  },
  auth: {
    getSession: async () => ({ data: { session: SESSIONE_FINTA } }),
    onAuthStateChange: (_callback: (evento: string, sessione: unknown) => void) => ({
      data: { subscription: { unsubscribe: () => {} } },
    }),
    signInWithPassword: async () => ({ error: null }),
    signOut: async () => ({ error: null }),
  },
  channel: (_nome: string) => new FakeChannel(),
  removeChannel: (canale: FakeChannel) => canale.rimuovi(),
};
