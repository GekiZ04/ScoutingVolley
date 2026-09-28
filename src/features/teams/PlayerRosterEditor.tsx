import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useSupabaseQuery } from '@/lib/useSupabaseQuery';
import { aggiungiGiocatore, archiviaGiocatore, importaGiocatori } from '@/db/teams';
import { analizzaCsvRoster, generaModelloCsvRoster } from '@/domain/importRoster';
import type { Player, Ruolo, Team } from '@/domain/types';

const RUOLI: Ruolo[] = ['palleggiatore', 'opposto', 'schiacciatore', 'centrale', 'libero'];

function scaricaModelloCsv(): void {
  const blob = new Blob(['﻿' + generaModelloCsvRoster()], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modello-roster.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function PlayerRosterEditor() {
  const { teamId } = useParams<{ teamId: string }>();
  const squadra = useSupabaseQuery<Team | null>(
    async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('id', teamId!).maybeSingle();
      if (error) throw error;
      return data as Team | null;
    },
    [teamId],
    ['teams'],
  );
  const giocatori = useSupabaseQuery<Player[]>(
    async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .eq('teamId', teamId!)
        .eq('attivo', true)
        .order('numero');
      if (error) throw error;
      return data as Player[];
    },
    [teamId],
    ['players'],
  );

  const [numero, setNumero] = useState('');
  const [nome, setNome] = useState('');
  const [ruolo, setRuolo] = useState<Ruolo>('schiacciatore');
  const [erroriImport, setErroriImport] = useState<string[] | null>(null);
  const [importoInCorso, setImportoInCorso] = useState(false);
  const inputFileRef = useRef<HTMLInputElement>(null);

  async function handleAggiungi(event: FormEvent) {
    event.preventDefault();
    if (!nome.trim() || !numero) return;
    await aggiungiGiocatore({ teamId: teamId!, numero: Number(numero), nome: nome.trim(), ruolo });
    setNumero('');
    setNome('');
  }

  async function handleImportaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !teamId) return;
    setErroriImport(null);
    setImportoInCorso(true);
    try {
      // FileReader invece di file.text(): piu' compatibile (jsdom nei test
      // non implementa File.prototype.text in tutte le versioni).
      const testo = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
      });
      const esito = analizzaCsvRoster(testo);
      if (!esito.ok) {
        setErroriImport(esito.errori);
        return;
      }
      await importaGiocatori(teamId, esito.giocatori);
    } catch (e) {
      setErroriImport([e instanceof Error ? e.message : 'Errore durante l\'importazione.']);
    } finally {
      setImportoInCorso(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-white">
      <Link to="/" className="mb-4 inline-block text-sm text-slate-400 hover:text-white">
        ← Home
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{squadra?.nome ?? '...'}</h1>
      <form onSubmit={handleAggiungi} className="mb-6 flex flex-wrap gap-3">
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          type="number"
          placeholder="Numero"
          className="w-24 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome giocatore"
          className="flex-1 rounded-lg bg-slate-800 px-4 py-3 text-lg"
        />
        <select
          value={ruolo}
          onChange={(e) => setRuolo(e.target.value as Ruolo)}
          className="rounded-lg bg-slate-800 px-4 py-3 text-lg"
        >
          {RUOLI.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-blue-700 px-6 py-3 text-lg font-semibold">
          Aggiungi
        </button>
      </form>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputFileRef.current?.click()}
          disabled={importoInCorso}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold disabled:opacity-40"
        >
          {importoInCorso ? 'Importazione...' : 'Importa roster da CSV'}
        </button>
        <input
          ref={inputFileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleImportaFile}
          className="hidden"
          data-testid="input-importa-csv"
        />
        <button type="button" onClick={scaricaModelloCsv} className="text-sm text-slate-400 underline hover:text-white">
          Scarica modello CSV
        </button>
      </div>
      {erroriImport && (
        <div
          role="alert"
          data-testid="errori-import"
          onClick={() => setErroriImport(null)}
          className="mb-6 cursor-pointer rounded-lg bg-red-700 px-4 py-3 text-sm"
        >
          <p className="mb-1 font-semibold">File non importato (tocca per chiudere):</p>
          <ul className="list-inside list-disc space-y-0.5">
            {erroriImport.map((errore) => (
              <li key={errore}>{errore}</li>
            ))}
          </ul>
        </div>
      )}
      <ul className="space-y-2">
        {(giocatori ?? []).map((giocatore) => (
          <li key={giocatore.id} className="flex items-center justify-between rounded-lg bg-slate-800 px-4 py-3">
            <span className="text-lg">
              #{giocatore.numero} {giocatore.nome} — {giocatore.ruolo}
            </span>
            <button
              type="button"
              onClick={() => archiviaGiocatore(giocatore.id)}
              className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold"
            >
              Archivia
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}
