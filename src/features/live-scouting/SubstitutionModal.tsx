import { useState } from 'react';
import type { Player, Squadra } from '@/domain/types';

export interface DatiSostituzione {
  squadra: Squadra;
  giocatoreEsceId: string;
  giocatoreEntraId: string;
}

export function SubstitutionModal({
  inCampoA,
  inCampoB,
  panchinaA,
  panchinaB,
  onConferma,
  onChiudi,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  panchinaA: Player[];
  panchinaB: Player[];
  onConferma: (dati: DatiSostituzione) => void;
  onChiudi: () => void;
}) {
  const [squadra, setSquadra] = useState<Squadra>('A');
  const [giocatoreEsceId, setGiocatoreEsceId] = useState('');
  const [giocatoreEntraId, setGiocatoreEntraId] = useState('');

  const inCampo = squadra === 'A' ? inCampoA : inCampoB;
  const panchina = squadra === 'A' ? panchinaA : panchinaB;

  function handleConferma() {
    if (!giocatoreEsceId || !giocatoreEntraId) return;
    onConferma({ squadra, giocatoreEsceId, giocatoreEntraId });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70" data-testid="modal-sostituzione">
      <div className="w-full max-w-lg rounded-xl bg-slate-900 p-6 text-white">
        <h2 className="mb-4 text-xl font-bold">Sostituzione</h2>
        <div className="mb-4 flex gap-3">
          <button type="button" onClick={() => setSquadra('A')} className={`rounded-lg px-4 py-2 ${squadra === 'A' ? 'bg-blue-700' : 'bg-slate-700'}`}>
            Squadra A
          </button>
          <button type="button" onClick={() => setSquadra('B')} className={`rounded-lg px-4 py-2 ${squadra === 'B' ? 'bg-blue-700' : 'bg-slate-700'}`}>
            Squadra B
          </button>
        </div>
        <label className="mb-3 block">
          Esce
          <select
            value={giocatoreEsceId}
            onChange={(e) => setGiocatoreEsceId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3"
          >
            <option value="">Seleziona...</option>
            {inCampo.map((g) => (
              <option key={g.id} value={g.id}>#{g.numero} {g.nome}</option>
            ))}
          </select>
        </label>
        <label className="mb-4 block">
          Entra
          <select
            value={giocatoreEntraId}
            onChange={(e) => setGiocatoreEntraId(e.target.value)}
            className="mt-1 block w-full rounded-lg bg-slate-800 px-4 py-3"
          >
            <option value="">Seleziona...</option>
            {panchina.map((g) => (
              <option key={g.id} value={g.id}>#{g.numero} {g.nome}</option>
            ))}
          </select>
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2">
            Annulla
          </button>
          <button type="button" onClick={handleConferma} className="rounded-lg bg-blue-700 px-4 py-2 font-semibold">
            Conferma
          </button>
        </div>
      </div>
    </div>
  );
}
