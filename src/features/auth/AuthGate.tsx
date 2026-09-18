import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

// Un link di invito/recupero Supabase arriva con #access_token=...&type=invite
// (o type=recovery) nell'URL: il client lo consuma subito per creare una
// sessione, quindi va letto qui, a livello di modulo, prima che qualsiasi
// effetto asincrono di supabase-js possa gia' aver rimosso l'hash dall'URL.
const hashAlCaricamento = typeof window !== 'undefined' ? window.location.hash : '';
const richiedeImpostazionePassword =
  hashAlCaricamento.includes('type=invite') || hashAlCaricamento.includes('type=recovery');

function SetPasswordForm({ onImpostata }: { onImpostata: () => void }) {
  const [password, setPassword] = useState('');
  const [conferma, setConferma] = useState('');
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrore(null);
    if (password.length < 8) {
      setErrore('La password deve avere almeno 8 caratteri.');
      return;
    }
    if (password !== conferma) {
      setErrore('Le due password non coincidono.');
      return;
    }
    setInCorso(true);
    const { error } = await supabase.auth.updateUser({ password });
    setInCorso(false);
    if (error) {
      setErrore('Impostazione password non riuscita: riprova.');
      return;
    }
    onImpostata();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-bold">Scouting Pallavolo</h1>
        <p className="text-sm text-slate-400">Imposta una password per il tuo account.</p>
        {errore && (
          <div role="alert" className="rounded-lg bg-red-700 px-4 py-3 text-sm font-semibold">
            {errore}
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nuova password"
          autoComplete="new-password"
          className="block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <input
          type="password"
          value={conferma}
          onChange={(e) => setConferma(e.target.value)}
          placeholder="Conferma password"
          autoComplete="new-password"
          className="block w-full rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <button
          type="submit"
          disabled={inCorso}
          className="w-full rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold disabled:opacity-50"
        >
          {inCorso ? 'Salvataggio...' : 'Imposta password'}
        </button>
      </form>
    </main>
  );
}

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
  const [passwordImpostata, setPasswordImpostata] = useState(!richiedeImpostazionePassword);

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

  if (!passwordImpostata) {
    return <SetPasswordForm onImpostata={() => setPasswordImpostata(true)} />;
  }

  return <>{children}</>;
}
