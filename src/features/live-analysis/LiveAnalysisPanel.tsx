import { analizzaTendenze, distribuzioneDirezioniAttacco } from '@/domain/analysis';
import type { Azione, Player } from '@/domain/types';

const ZONE_CENTRALE = [6, 5, 1];

function RigaGiocatore({ giocatore, azioni }: { giocatore: Player; azioni: Azione[] }) {
  const tendenze = analizzaTendenze(azioni, giocatore.id);

  if (tendenze.tentativi === 0) {
    return (
      <tr className="border-t border-slate-700">
        <td className="py-2">#{giocatore.numero} {giocatore.nome}</td>
        <td className="py-2 text-slate-500" colSpan={2}>Nessun attacco registrato</td>
      </tr>
    );
  }

  const classeAllerta = tendenze.allerta ? 'bg-red-900/40' : '';

  if (giocatore.ruolo === 'centrale') {
    const distribuzione = distribuzioneDirezioniAttacco(azioni, giocatore.id);
    const testoZone = ZONE_CENTRALE.map(
      (z) => `zona ${z}: ${(((distribuzione[z] ?? 0) / tendenze.tentativi) * 100).toFixed(0)}%`,
    ).join(', ');
    return (
      <tr className={`border-t border-slate-700 ${classeAllerta}`}>
        <td className="py-2">#{giocatore.numero} {giocatore.nome}</td>
        <td className="py-2" data-testid={`analisi-${giocatore.id}`}>{testoZone}</td>
        <td className="py-2">Errore+murato: {(tendenze.percErrore + tendenze.percMurato).toFixed(0)}%</td>
      </tr>
    );
  }

  return (
    <tr className={`border-t border-slate-700 ${classeAllerta}`}>
      <td className="py-2">#{giocatore.numero} {giocatore.nome}</td>
      <td className="py-2" data-testid={`analisi-${giocatore.id}`}>
        Colpo principale: {tendenze.colpoPrincipale} (parallela {tendenze.percParallela.toFixed(0)}%, diagonale{' '}
        {tendenze.percDiagonale.toFixed(0)}%, centro {tendenze.percCentro.toFixed(0)}%)
      </td>
      <td className="py-2">Errore+murato: {(tendenze.percErrore + tendenze.percMurato).toFixed(0)}%</td>
    </tr>
  );
}

export function LiveAnalysisPanel({
  azioni,
  giocatoriA,
  giocatoriB,
  onChiudi,
}: {
  azioni: Azione[];
  giocatoriA: Player[];
  giocatoriB: Player[];
  onChiudi: () => void;
}) {
  const squadre = [
    { titolo: 'Squadra A', giocatori: giocatoriA },
    { titolo: 'Squadra B', giocatori: giocatoriB },
  ];

  return (
    <div className="fixed inset-0 overflow-y-auto bg-black/80 p-6 text-white" data-testid="pannello-analisi-live">
      <div className="mx-auto max-w-3xl rounded-xl bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Analisi live</h2>
          <button type="button" onClick={onChiudi} className="rounded-lg bg-slate-700 px-4 py-2">
            Chiudi
          </button>
        </div>
        {squadre.map(({ titolo, giocatori }) => (
          <div key={titolo} className="mb-6">
            <h3 className="mb-2 text-xl font-semibold">{titolo}</h3>
            <table className="w-full text-left text-sm">
              <tbody>
                {giocatori.map((g) => (
                  <RigaGiocatore key={g.id} giocatore={g} azioni={azioni} />
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
