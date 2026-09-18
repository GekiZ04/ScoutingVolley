import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { creaSquadra } from '@/db/teams';
import type { Team } from '@/domain/types';

export function TeamListPage() {
  const squadre = useSupabaseQuery<Team[]>(
    async () => {
      const { data, error } = await supabase.from('teams').select('*').order('nome');
      if (error) throw error;
      return data as Team[];
    },
    [],
    ['teams'],
  );
  const [nome, setNome] = useState('');

  async function handleCrea(event: FormEvent) {
    event.preventDefault();
    if (!nome.trim()) return;
    await creaSquadra(nome.trim());
    setNome('');
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <Link to="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Squadre</h1>
      <form onSubmit={handleCrea} className="mb-6 flex gap-3">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome squadra"
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Crea squadra
        </button>
      </form>
      <ul className="space-y-2">
        {(squadre ?? []).map((squadra) => (
          <li key={squadra.id}>
            <Link
              to={`/squadre/${squadra.id}`}
              className="block rounded-lg bg-slate-800 px-4 py-3 text-lg hover:bg-slate-700"
            >
              {squadra.nome}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
