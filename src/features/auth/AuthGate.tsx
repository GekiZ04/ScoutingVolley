import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrore(null);
    setInCorso(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setInCorso(false);
    if (error) setErrore('Accesso non riuscito: controlla email e password.');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Scouting Pallavolo</h1>
        <p className="text-sm text-slate-400">Accesso riservato ai due dispositivi autorizzati.</p>
        {errore && (
          <div role="alert" className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold">
            {errore}
          </div>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="username"
          className="block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <button
          type="submit"
          disabled={inCorso}
          className="w-full rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-50"
        >
          {inCorso ? 'Accesso in corso...' : 'Accedi'}
        </button>
      </form>
    </main>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_evento, nuovaSessione) => {
      setSession(nuovaSessione);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Caricamento...
      </main>
    );
  }

  if (session === null) {
    return <LoginForm />;
  }

  return <>{children}</>;
}
