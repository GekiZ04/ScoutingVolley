import { COLONNE_DISTRIBUZIONE, type DistribuzionePalleggio } from '@/domain/distribuzionePalleggio';
import type { Player } from '@/domain/types';

const CELLA = 'border border-black px-1.5 py-0.5 text-center';
const SEPARATORE = 'border-l-[3px] border-l-slate-800';

const percentuale = (n: number, totale: number) => (totale > 0 ? `${Math.round((n / totale) * 100)}%` : '');

// Una colonna per Totale, ricezione positiva/negativa e fasce di punteggio:
// per ogni giocatrice gli attacchi ricevuti e la quota sul totale della colonna.
export function DistribuzionePalleggioTabella({
  nomeSquadra,
  distribuzione,
  giocatori,
  squadra,
}: {
  nomeSquadra: string;
  distribuzione: DistribuzionePalleggio;
  giocatori: Player[];
  squadra: 'A' | 'B';
}) {
  const { righe, totali } = distribuzione;
  return (
    <div className="break-inside-avoid" data-testid={`distribuzione-palleggio-${squadra}`}>
      <h3 className="mb-1 font-bold">{nomeSquadra}</h3>
      {righe.length === 0 ? (
        <p className="text-xs">Nessun attacco rilevato.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-collapse text-[11px]">
            <thead>
              <tr className="font-bold">
                <th rowSpan={2} className={CELLA}>
                  #
                </th>
                <th rowSpan={2} className={`${CELLA} text-left`}>
                  Atleta
                </th>
                {COLONNE_DISTRIBUZIONE.map((c, i) => (
                  <th key={c.chiave} colSpan={2} className={i === 0 || i === 1 || i === 3 ? `${CELLA} ${SEPARATORE}` : CELLA}>
                    {c.etichetta}
                  </th>
                ))}
              </tr>
              <tr className="font-bold">
                {COLONNE_DISTRIBUZIONE.map((c, i) => (
                  <th key={c.chiave} colSpan={2} className={i === 0 || i === 1 || i === 3 ? `${CELLA} ${SEPARATORE}` : CELLA}>
                    {totali[c.chiave]} att.
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {righe.map(({ giocatoreId, conteggi }) => {
                const g = giocatori.find((x) => x.id === giocatoreId);
                return (
                  <tr key={giocatoreId}>
                    <td className={CELLA}>{g?.numero ?? ''}</td>
                    <td className={`${CELLA} whitespace-nowrap text-left`}>{g?.nome ?? '?'}</td>
                    {COLONNE_DISTRIBUZIONE.map((c, i) => (
                      <Celle key={c.chiave} n={conteggi[c.chiave]} totale={totali[c.chiave]} separa={i === 0 || i === 1 || i === 3} />
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Celle({ n, totale, separa }: { n: number; totale: number; separa: boolean }) {
  return (
    <>
      <td className={separa ? `${CELLA} ${SEPARATORE}` : CELLA}>{n || ''}</td>
      <td className={`${CELLA} font-semibold`}>{n ? percentuale(n, totale) : ''}</td>
    </>
  );
}
