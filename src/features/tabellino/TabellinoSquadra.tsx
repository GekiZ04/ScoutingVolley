import { GRUPPI_TABELLINO } from '@/features/export/tabellinoColonne';
import type { CellaSet, PuntiVinti } from '@/domain/tabellinoExtra';

export interface RigaTabellinoSquadra {
  numero: number;
  nome: string;
  libero: boolean;
  valori: (number | string)[];
  celleSet?: CellaSet[];
}

export interface TabellinoSquadraProps {
  nomeSquadra: string;
  righe: RigaTabellinoSquadra[];
  totale: (number | string)[];
  puntiVinti: { etichetta: string; valori: PuntiVinti }[];
  /** Assente = niente colonne Set (es. analisi su piu' partite). */
  colonneSet?: { primaBattuta: boolean[] };
}

const NUMERO_SET = [1, 2, 3, 4, 5];
const CELLA = 'border border-black px-1 py-0.5 text-center';

function CellaSetTabellino({ cella, numero }: { cella: CellaSet | undefined; numero: number }) {
  return (
    <td className={CELLA}>
      {cella?.tipo === 'titolare' && (
        <span
          data-testid={`cella-set-${numero}`}
          className={`inline-block min-w-[1.25rem] border border-black px-0.5 ${cella.palleggiatore ? 'font-bold' : ''}`}
        >
          {cella.posizione}
        </span>
      )}
      {cella?.tipo === 'entrato' && (
        <span data-testid={`cella-set-${numero}`} className="inline-block h-4 w-5 border border-black" />
      )}
    </td>
  );
}

export function TabellinoSquadra({ nomeSquadra, righe, totale, puntiVinti, colonneSet }: TabellinoSquadraProps) {
  return (
    <section className="mb-8 break-inside-avoid">
      <h2 className="mb-1 text-lg font-bold">{nomeSquadra}</h2>
      <div className="overflow-x-auto">
        <table className="border-collapse text-[11px]">
          <thead>
            <tr className="bg-white font-bold">
              {colonneSet && (
                <th colSpan={NUMERO_SET.length} className={CELLA}>
                  Set
                </th>
              )}
              <th rowSpan={2} className={CELLA}>
                #
              </th>
              <th rowSpan={2} className={`${CELLA} text-left`}>
                Giocatore
              </th>
              {GRUPPI_TABELLINO.map((gruppo) => (
                <th key={gruppo.titolo} colSpan={gruppo.colonne.length} className={CELLA}>
                  {gruppo.titolo}
                </th>
              ))}
            </tr>
            <tr className="bg-white font-bold">
              {colonneSet &&
                NUMERO_SET.map((n, i) => (
                  <th key={n} className={CELLA}>
                    <span
                      data-testid={colonneSet.primaBattuta[i] ? `prima-battuta-set-${n}` : undefined}
                      className={
                        colonneSet.primaBattuta[i]
                          ? 'inline-block min-w-[1.25rem] rounded-full border border-black'
                          : undefined
                      }
                    >
                      {n}
                    </span>
                  </th>
                ))}
              {GRUPPI_TABELLINO.flatMap((gruppo) =>
                gruppo.colonne.map((colonna, i) => (
                  <th key={`${gruppo.titolo}-${i}`} className={CELLA}>
                    {colonna}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {righe.map((riga) => (
              <tr key={`${riga.numero}-${riga.nome}`}>
                {colonneSet && NUMERO_SET.map((n, i) => <CellaSetTabellino key={n} numero={n} cella={riga.celleSet?.[i]} />)}
                <td className={`${CELLA} font-semibold`}>{riga.numero}</td>
                <td className={`${CELLA} whitespace-nowrap text-left`}>
                  {riga.nome}
                  {riga.libero && <span className="ml-1 font-bold">L</span>}
                </td>
                {riga.valori.map((v, i) => (
                  <td key={i} className={CELLA}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="font-bold">
              <td colSpan={2 + (colonneSet ? NUMERO_SET.length : 0)} className={`${CELLA} text-left`}>
                Totale squadra
              </td>
              {totale.map((v, i) => (
                <td key={i} data-testid={`totale-${i}`} className={CELLA}>
                  {v}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <table className="mt-2 border-collapse text-[11px]">
        <thead>
          <tr className="font-bold">
            <th className={`${CELLA} text-left`}>Punti Vinti</th>
            <th className={CELLA}>Batt</th>
            <th className={CELLA}>Att</th>
            <th className={CELLA}>Mur</th>
            <th className={CELLA}>Er.Av</th>
          </tr>
        </thead>
        <tbody>
          {puntiVinti.map(({ etichetta, valori }) => (
            <tr key={etichetta}>
              <td className={`${CELLA} text-left`}>{etichetta}</td>
              <td className={CELLA}>{valori.batt}</td>
              <td className={CELLA}>{valori.att}</td>
              <td className={CELLA}>{valori.mur}</td>
              <td className={CELLA}>{valori.erAv}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
