import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { creaSquadra, aggiungiGiocatore } from '@/db/teams';
import type { Ruolo } from '@/domain/types';

const ROSTER_AQUILE: { numero: number; nome: string; ruolo: Ruolo }[] = [
  { numero: 1, nome: 'Rossi', ruolo: 'palleggiatore' },
  { numero: 2, nome: 'Bianchi', ruolo: 'opposto' },
  { numero: 3, nome: 'Verdi', ruolo: 'schiacciatore' },
  { numero: 4, nome: 'Neri', ruolo: 'schiacciatore' },
  { numero: 5, nome: 'Gialli', ruolo: 'centrale' },
  { numero: 6, nome: 'Blu', ruolo: 'centrale' },
  { numero: 7, nome: 'Marroni', ruolo: 'libero' },
];

const ROSTER_TIGRI: { numero: number; nome: string; ruolo: Ruolo }[] = [
  { numero: 1, nome: 'Ferrari', ruolo: 'palleggiatore' },
  { numero: 2, nome: 'Russo', ruolo: 'opposto' },
  { numero: 3, nome: 'Colombo', ruolo: 'schiacciatore' },
  { numero: 4, nome: 'Ricci', ruolo: 'schiacciatore' },
  { numero: 5, nome: 'Marino', ruolo: 'centrale' },
  { numero: 6, nome: 'Greco', ruolo: 'centrale' },
  { numero: 7, nome: 'Bruno', ruolo: 'libero' },
];

export function SeedTestDataPage() {
  const navigate = useNavigate();
  const [inCorso, setInCorso] = useState(false);

  async function handleGenera() {
    setInCorso(true);
    const aquile = await creaSquadra('Aquile Volley');
    for (const giocatore of ROSTER_AQUILE) {
      await aggiungiGiocatore({ teamId: aquile.id, ...giocatore });
    }
    const tigri = await creaSquadra('Tigri Pallavolo');
    for (const giocatore of ROSTER_TIGRI) {
      await aggiungiGiocatore({ teamId: tigri.id, ...giocatore });
    }
    navigate('/squadre');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 p-6 text-white">
      <Link to="/" className="self-start text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>
      <h1 className="text-2xl font-bold">Dati di test</h1>
      <p className="max-w-md text-center text-slate-400">
        Crea su questo dispositivo due squadre di prova (Aquile Volley e Tigri Pallavolo), ognuna
        con 6 titolari e un libero in panchina.
      </p>
      <button
        type="button"
        onClick={() => handleGenera()}
        disabled={inCorso}
        className="rounded-lg bg-blue-700 px-6 py-4 text-lg font-semibold disabled:opacity-50"
      >
        {inCorso ? 'Creazione in corso...' : 'Genera squadre di test'}
      </button>
    </main>
  );
}
