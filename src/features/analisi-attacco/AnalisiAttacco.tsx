import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  attacchiPerAnalisi,
  densitaArrivi,
  filtraAttacchi,
  griglia1m,
  riepilogoAttacchi,
  settoriAngolo,
  type AttaccoAnalisi,
  type FaseAttacco,
  type SettoreAngolo,
  type ZonaAttacco,
} from '@/domain/analisiAttacco';
import type { EsitoAttacco } from '@/domain/analysis';
import {
  COLORE_CALORE,
  COLORE_ESITO,
  ETICHETTA_ESITO,
  NUMERI_ZONE,
  RAMPA,
  TESTO,
  TESTO_SECONDARIO,
  coloreRampa,
  fondoPer,
  poligonoSettore,
  puntoEtichetta,
} from './geometriaCampo';
import { generaPdfMappeAttacco } from './esportaMappePdf';
import { scaricaPdf } from '@/features/export/exportPdf';
import type { Azione, Player, Rally, Squadra } from '@/domain/types';

type Vista = 'calore' | 'griglia' | 'angoli' | 'kill' | 'traiettorie';
const VISTE: { valore: Vista; etichetta: string }[] = [
  { valore: 'calore', etichetta: 'Mappa di calore' },
  { valore: 'griglia', etichetta: 'Griglia 1 m' },
  { valore: 'angoli', etichetta: 'Angoli' },
  { valore: 'kill', etichetta: 'Kill % per angolo' },
  { valore: 'traiettorie', etichetta: 'Traiettorie' },
];

const ZONE: { valore: ZonaAttacco; etichetta: string }[] = [
  { valore: 4, etichetta: 'Zona 4 (sinistra)' },
  { valore: 3, etichetta: 'Zona 3 (centro)' },
  { valore: 2, etichetta: 'Zona 2 (destra)' },
  { valore: 5, etichetta: 'Zona 5 (seconda linea sx)' },
  { valore: 6, etichetta: 'Zona 6 (pipe)' },
  { valore: 1, etichetta: 'Zona 1 (seconda linea dx)' },
];

const fmt = (n: number) => `${Math.round(n)}%`;

// Campo avversario visto da chi attacca: rete in basso, fondo in alto, zone
// avversarie 1-6-5 / 9-8-7 / 2-3-4. Sotto la rete la meta' campo di chi attacca.
function CampoAnalisi({
  titolo,
  children,
  sopraRete,
  fondo = 9.8,
  numeriZone = true,
}: {
  titolo?: string;
  children: ReactNode;
  sopraRete?: ReactNode;
  fondo?: number;
  // Nelle viste con numeri sui dati i numeri delle zone si sovrapporrebbero.
  numeriZone?: boolean;
}) {
  return (
    <figure className="w-full max-w-md">
      {titolo && <figcaption className="mb-1 text-center text-sm font-semibold">{titolo}</figcaption>}
      <svg
        viewBox={`-0.7 -0.7 10.4 ${fondo + 0.7}`}
        className="w-full"
        data-testid="campo-analisi"
        role="img"
        aria-label={titolo ?? 'Campo'}
      >
        <rect x={-0.7} y={9} width={10.4} height={fondo - 9} fill="#f0efec" />
        <rect x={0} y={0} width={9} height={9} fill="#ffffff" stroke={TESTO_SECONDARIO} strokeWidth={0.05} />
        {[3, 6].map((v) => (
          <g key={v} stroke="#d4d3cf" strokeWidth={0.03}>
            <line x1={v} y1={0} x2={v} y2={9} />
            <line x1={0} y1={v} x2={9} y2={v} />
          </g>
        ))}
        {fondo > 12.2 && (
          <line x1={0} y1={12} x2={9} y2={12} stroke={TESTO_SECONDARIO} strokeWidth={0.03} strokeDasharray="0.15 0.15" />
        )}
        {children}
        {numeriZone &&
          NUMERI_ZONE.map(([testo, x, y]) => (
          <text
            key={testo}
            x={x + 0.1}
            y={y + 0.32}
            fontSize={0.26}
            fill={TESTO_SECONDARIO}
            stroke="#ffffff"
            strokeWidth={0.08}
            paintOrder="stroke"
          >
            {testo}
          </text>
        ))}
        <line x1={-0.7} y1={9} x2={9.7} y2={9} stroke={TESTO} strokeWidth={0.12} />
        {sopraRete}
      </svg>
    </figure>
  );
}

function LegendaRampa({ massimo, etichetta }: { massimo: string; etichetta: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: TESTO_SECONDARIO }}>
      <span>{etichetta}: 0</span>
      <span className="h-2 w-32 rounded" style={{ background: `linear-gradient(to right, ${RAMPA[0]}, ${RAMPA[RAMPA.length - 1]})` }} />
      <span>{massimo}</span>
    </div>
  );
}

function Riepilogo({ attacchi, extra }: { attacchi: AttaccoAnalisi[]; extra?: string }) {
  const r = riepilogoAttacchi(attacchi);
  return (
    <p className="text-sm" data-testid="riepilogo-attacchi">
      <strong>{r.totale} attacchi</strong> · Kill {fmt(r.killPercento)} · Efficienza {fmt(r.efficienzaPercento)} · Punto vinto{' '}
      {r.puntoVintoPercento === null ? '—' : fmt(r.puntoVintoPercento)}
      {extra ? ` · ${extra}` : ''}
    </p>
  );
}

function VistaCalore({ attacchi }: { attacchi: AttaccoAnalisi[] }) {
  const d = useMemo(() => densitaArrivi(attacchi), [attacchi]);
  const sfumatura = useId();
  return (
    <CampoAnalisi>
      <defs>
        <filter id={sfumatura} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation={0.12} />
        </filter>
      </defs>
      <g data-testid="mappa-calore" filter={`url(#${sfumatura})`}>
        {d.valori.flatMap((riga, r) =>
          riga.map((v, c) =>
            v < 0.03 ? null : (
              <rect
                key={`${r}-${c}`}
                x={d.x0 + c * d.passo}
                y={d.y0 + r * d.passo}
                width={d.passo + 0.01}
                height={d.passo + 0.01}
                fill={COLORE_CALORE}
                fillOpacity={0.9 * v ** 1.5}
              />
            ),
          ),
        )}
      </g>
    </CampoAnalisi>
  );
}

function VistaGriglia({ attacchi }: { attacchi: AttaccoAnalisi[] }) {
  const g = useMemo(() => griglia1m(attacchi), [attacchi]);
  const dentro = g.totale - g.fuori;
  const massimo = Math.max(1, ...g.celle.flat());
  return (
    <>
      <CampoAnalisi numeriZone={false}>
        {g.celle.flatMap((riga, r) =>
          riga.map((conteggio, c) => {
            const quota = g.totale === 0 ? 0 : (conteggio / g.totale) * 100;
            const colore = coloreRampa(conteggio / massimo);
            return (
              <g key={`${r}-${c}`} data-testid={`cella-${r}-${c}`}>
                {conteggio > 0 && (
                  <>
                    <rect x={c + 0.03} y={r + 0.03} width={0.94} height={0.94} rx={0.06} fill={colore.fondo}>
                      <title>{`${conteggio} attacchi (${fmt(quota)})`}</title>
                    </rect>
                    <text x={c + 0.5} y={r + 0.68} fontSize={0.3} textAnchor="middle" fill={colore.testo}>
                      {fmt(quota)}
                    </text>
                  </>
                )}
              </g>
            );
          }),
        )}
      </CampoAnalisi>
      <p className="mt-1 text-xs" style={{ color: TESTO_SECONDARIO }}>
        In campo {dentro}, fuori campo {g.fuori}. Percentuali sul totale degli attacchi.
      </p>
      <LegendaRampa etichetta="Attacchi per quadrato" massimo={String(massimo)} />
    </>
  );
}

function Ventaglio({
  attacchi,
  colore,
  etichetta,
  titolo,
}: {
  attacchi: AttaccoAnalisi[];
  colore: (s: SettoreAngolo, massimaQuota: number) => { fondo: string; testo: string };
  etichetta: (s: SettoreAngolo) => string[];
  titolo?: string;
}) {
  const clip = useId();
  const { settori, origineMedia } = useMemo(() => settoriAngolo(attacchi), [attacchi]);
  const pieni = settori.filter((s) => s.n > 0);
  const massimaQuota = Math.max(1, ...pieni.map((s) => s.percentuale));

  // Etichette e partenza media vanno sopra i numeri delle zone.
  const sopra = origineMedia && (
    <>
      <circle cx={origineMedia.x} cy={origineMedia.y} r={0.2} fill={TESTO} />
      {pieni.map((s) => {
        const p = puntoEtichetta(origineMedia, (s.daGradi + s.aGradi) / 2, s.aGradi - s.daGradi);
        if (!p) return null;
        const righe = etichetta(s);
        return (
          <text
            key={s.daGradi}
            data-testid={`settore-${s.daGradi}`}
            x={p.x}
            y={p.y - ((righe.length - 1) * 0.38) / 2}
            fontSize={0.3}
            textAnchor="middle"
            fill={colore(s, massimaQuota).testo}
          >
            {righe.map((riga, i) => (
              <tspan key={riga} x={p.x} dy={i === 0 ? 0 : 0.38}>
                {riga}
              </tspan>
            ))}
          </text>
        );
      })}
    </>
  );

  return (
    <CampoAnalisi
      titolo={titolo}
      fondo={fondoPer(origineMedia ? [origineMedia] : [])}
      sopraRete={sopra}
      numeriZone={false}
    >
      <defs>
        <clipPath id={clip}>
          <rect x={0} y={0} width={9} height={9} />
        </clipPath>
      </defs>
      {origineMedia && (
        <g clipPath={`url(#${clip})`}>
          {pieni.map((s) => {
            const punti = poligonoSettore(origineMedia, s.daGradi, s.aGradi);
            return (
              <polygon
                key={s.daGradi}
                points={punti.map((p) => `${p.x},${p.y}`).join(' ')}
                fill={colore(s, massimaQuota).fondo}
                stroke="#ffffff"
                strokeWidth={0.06}
              >
                <title>{etichetta(s).join(' ')}</title>
              </polygon>
            );
          })}
        </g>
      )}
    </CampoAnalisi>
  );
}

function TabellaSettori({ attacchi }: { attacchi: AttaccoAnalisi[] }) {
  const { settori } = settoriAngolo(attacchi);
  const pieni = settori.filter((s) => s.n > 0);
  if (pieni.length === 0) return null;
  return (
    <table className="mt-2 border-collapse text-xs">
      <thead>
        <tr>
          {['Angolo', 'N', '% attacchi', 'Kill %'].map((t) => (
            <th key={t} className="border border-slate-300 px-2 py-0.5 text-left">
              {t}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {pieni.map((s) => (
          <tr key={s.daGradi}>
            <td className="border border-slate-300 px-2 py-0.5">
              {s.daGradi}° / {s.aGradi}°
            </td>
            <td className="border border-slate-300 px-2 py-0.5">{s.n}</td>
            <td className="border border-slate-300 px-2 py-0.5">{fmt(s.percentuale)}</td>
            <td className="border border-slate-300 px-2 py-0.5">{fmt(s.killPercento)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function VistaTraiettorie({ attacchi }: { attacchi: AttaccoAnalisi[] }) {
  const conteggi = { punto: 0, difeso: 0, errore: 0 } as Record<EsitoAttacco, number>;
  for (const a of attacchi) conteggi[a.esito] += 1;
  return (
    <>
      <CampoAnalisi fondo={fondoPer(attacchi.flatMap((a) => [a.origine, a.arrivo]))}>
        {attacchi.map((a) => {
          const colore = COLORE_ESITO[a.esito];
          const { x, y } = a.arrivo;
          return (
            <g key={a.id} data-testid={`traiettoria-${a.id}`}>
              <line
                x1={a.origine.x}
                y1={a.origine.y}
                x2={x}
                y2={y}
                stroke={colore}
                strokeWidth={0.07}
                strokeOpacity={0.8}
                strokeDasharray={a.toccoMuro ? '0.25 0.15' : undefined}
              />
              {a.esito === 'punto' && <circle cx={x} cy={y} r={0.16} fill={colore} stroke="#ffffff" strokeWidth={0.04} />}
              {a.esito === 'difeso' && <circle cx={x} cy={y} r={0.15} fill="#ffffff" stroke={colore} strokeWidth={0.06} />}
              {a.esito === 'errore' && (
                <g stroke={colore} strokeWidth={0.07}>
                  <line x1={x - 0.15} y1={y - 0.15} x2={x + 0.15} y2={y + 0.15} />
                  <line x1={x - 0.15} y1={y + 0.15} x2={x + 0.15} y2={y - 0.15} />
                </g>
              )}
            </g>
          );
        })}
      </CampoAnalisi>
      <ul className="mt-2 flex flex-wrap gap-4 text-xs" data-testid="legenda-esiti">
        {(['punto', 'difeso', 'errore'] as const).map((esito) => (
          <li key={esito} className="flex items-center gap-1">
            <span className="inline-block h-1 w-5 rounded" style={{ background: COLORE_ESITO[esito] }} />
            <span style={{ color: TESTO }}>
              {ETICHETTA_ESITO[esito]} {conteggi[esito]}
            </span>
          </li>
        ))}
        <li style={{ color: TESTO_SECONDARIO }}>tratteggio = toccato a muro</li>
      </ul>
    </>
  );
}

export function AnalisiAttacco({
  azioni,
  rallies = [],
  giocatori,
  nomiSquadre = { A: 'Squadra A', B: 'Squadra B' },
  sets = [],
  titolo,
  onChiudi,
}: {
  azioni: Azione[];
  rallies?: Rally[];
  giocatori: Player[];
  nomiSquadre?: Record<Squadra, string>;
  sets?: { id: string; numero: number }[];
  // Di quale partita (o partite) si tratta: va nel titolo del PDF.
  titolo?: string;
  onChiudi: () => void;
}) {
  const [squadra, setSquadra] = useState<Squadra>('A');
  const [giocatoreId, setGiocatoreId] = useState('');
  const [zona, setZona] = useState('');
  const [fase, setFase] = useState('');
  const [setId, setSetId] = useState('');
  const [vista, setVista] = useState<Vista>('calore');
  const [errore, setErrore] = useState<string | null>(null);

  const tutti = useMemo(() => attacchiPerAnalisi(azioni, rallies), [azioni, rallies]);
  const dellaSquadra = filtraAttacchi(tutti, { squadra });
  const giocatoriConAttacchi = useMemo(() => {
    const perGiocatore = new Map<string, number>();
    for (const a of dellaSquadra) if (a.giocatoreId) perGiocatore.set(a.giocatoreId, (perGiocatore.get(a.giocatoreId) ?? 0) + 1);
    const unici = new Map(giocatori.map((g) => [g.id, g]));
    return [...perGiocatore.entries()]
      .map(([id, n]) => ({ giocatore: unici.get(id), id, n }))
      .sort((x, y) => (x.giocatore?.numero ?? 999) - (y.giocatore?.numero ?? 999));
  }, [dellaSquadra, giocatori]);

  const filtri = {
    squadra,
    giocatoreId: giocatoreId || null,
    zona: zona ? (Number(zona) as ZonaAttacco) : null,
    setId: setId || null,
  };
  const senzaFase = filtraAttacchi(tutti, filtri);
  const attacchi = fase ? filtraAttacchi(senzaFase, { fase: fase as FaseAttacco }) : senzaFase;

  function esportaPdf() {
    try {
      setErrore(null);
      const nomeGiocatore = giocatoriConAttacchi.find((g) => g.id === giocatoreId)?.giocatore;
      const descrizione = [
        `Giocatore: ${nomeGiocatore ? `#${nomeGiocatore.numero} ${nomeGiocatore.nome}` : 'tutti'}`,
        `Zona: ${ZONE.find((z) => String(z.valore) === zona)?.etichetta ?? 'tutte'}`,
        `Fase: ${fase === 'ricezione' ? 'cambio palla' : fase === 'transizione' ? 'transizione' : 'tutte'}`,
        ...(sets.length > 1 ? [`Set: ${sets.find((x) => x.id === setId)?.numero ?? 'tutti'}`] : []),
      ].join(' | ');
      const blob = generaPdfMappeAttacco({
        attacchi,
        attacchiSenzaFase: senzaFase,
        titolo: titolo ? `${nomiSquadre[squadra]} - ${titolo}` : nomiSquadre[squadra],
        filtri: descrizione,
      });
      const nomeFile = `mappe-attacco-${nomiSquadre[squadra].replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')}.pdf`;
      scaricaPdf(nomeFile, blob);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore durante l'esportazione");
    }
  }

  const select = 'mt-1 block rounded border border-slate-400 bg-white px-2 py-1 text-sm';
  const coloreQuota = (s: SettoreAngolo, massimaQuota: number) => coloreRampa(s.percentuale / massimaQuota);
  const coloreKill = (s: SettoreAngolo) => coloreRampa(s.killPercento / 100);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white p-4 text-black" data-testid="pannello-mappe-attacco">
      <div className="mx-auto max-w-5xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Mappe attacco</h2>
          <div className="flex gap-2">
            <button type="button" onClick={esportaPdf} className="rounded border border-black px-3 py-1 text-sm font-semibold">
              Esporta PDF
            </button>
            <button type="button" onClick={onChiudi} className="rounded border border-black px-3 py-1 text-sm font-semibold">
              Chiudi
            </button>
          </div>
        </div>
        {errore && (
          <div role="alert" className="mb-3 border border-black px-3 py-2 text-sm">
            {errore}
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-3">
          <label className="text-xs font-semibold">
            Squadra
            <select
              className={select}
              value={squadra}
              onChange={(e) => {
                setSquadra(e.target.value as Squadra);
                setGiocatoreId('');
              }}
            >
              <option value="A">{nomiSquadre.A}</option>
              <option value="B">{nomiSquadre.B}</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Giocatore
            <select className={select} value={giocatoreId} onChange={(e) => setGiocatoreId(e.target.value)}>
              <option value="">Tutti</option>
              {giocatoriConAttacchi.map(({ giocatore, id, n }) => (
                <option key={id} value={id}>
                  {giocatore ? `#${giocatore.numero} ${giocatore.nome}` : 'Sconosciuto'} ({n})
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold">
            Zona di partenza
            <select className={select} value={zona} onChange={(e) => setZona(e.target.value)}>
              <option value="">Tutte</option>
              {ZONE.map((z) => (
                <option key={z.valore} value={z.valore}>
                  {z.etichetta}
                </option>
              ))}
            </select>
          </label>
          {vista !== 'kill' && (
            <label className="text-xs font-semibold">
              Fase
              <select className={select} value={fase} onChange={(e) => setFase(e.target.value)}>
                <option value="">Tutte</option>
                <option value="ricezione">Cambio palla (dopo ricezione)</option>
                <option value="transizione">Transizione</option>
              </select>
            </label>
          )}
          {sets.length > 1 && (
            <label className="text-xs font-semibold">
              Set
              <select className={select} value={setId} onChange={(e) => setSetId(e.target.value)}>
                <option value="">Tutti</option>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    Set {s.numero}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Vista">
          {VISTE.map((v) => (
            <button
              key={v.valore}
              type="button"
              aria-pressed={vista === v.valore}
              onClick={() => setVista(v.valore)}
              className={`rounded border px-3 py-1 text-sm ${vista === v.valore ? 'border-black bg-black text-white' : 'border-slate-400 bg-white'}`}
            >
              {v.etichetta}
            </button>
          ))}
        </div>

        {vista !== 'kill' && <Riepilogo attacchi={attacchi} />}

        {(vista === 'kill' ? senzaFase : attacchi).length === 0 ? (
          <p className="mt-4 text-sm" style={{ color: TESTO_SECONDARIO }}>
            Nessun attacco con partenza e arrivo per questi filtri.
          </p>
        ) : (
          <div className="mt-2">
            {vista === 'calore' && <VistaCalore attacchi={attacchi} />}
            {vista === 'griglia' && <VistaGriglia attacchi={attacchi} />}
            {vista === 'angoli' && (
              <>
                <Ventaglio
                  attacchi={attacchi}
                  colore={coloreQuota}
                  etichetta={(s) => [fmt(s.percentuale), `N=${s.n}`]}
                />
                <LegendaRampa etichetta="% di attacchi" massimo="massimo" />
                <TabellaSettori attacchi={attacchi} />
              </>
            )}
            {vista === 'kill' && (
              <>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(['ricezione', 'transizione'] as const).map((f) => {
                    const diFase = filtraAttacchi(senzaFase, { fase: f });
                    return (
                      <div key={f}>
                        <Ventaglio
                          titolo={f === 'ricezione' ? 'Cambio palla' : 'Transizione'}
                          attacchi={diFase}
                          colore={coloreKill}
                          etichetta={(s) => [`Kill ${fmt(s.killPercento)}`, `N=${s.n}`]}
                        />
                        <Riepilogo attacchi={diFase} />
                        <TabellaSettori attacchi={diFase} />
                      </div>
                    );
                  })}
                </div>
                <LegendaRampa etichetta="Kill %" massimo="100%" />
              </>
            )}
            {vista === 'traiettorie' && <VistaTraiettorie attacchi={attacchi} />}
          </div>
        )}

        <p className="mt-4 text-xs" style={{ color: TESTO_SECONDARIO }}>
          Campo avversario visto da chi attacca, rete in basso. Angoli: 0° = dritto, positivi verso la destra di chi attacca;
          il punto nero e&apos; la partenza media. Contano solo gli attacchi con partenza e arrivo segnati. Numero di
          muratori e tipo di colpo non sono rilevati.
        </p>
      </div>
    </div>
  );
}
