import { useRef, type MouseEvent } from 'react';
import type { Player, Punto, Squadra } from '@/domain/types';
import { costruisciMarker, fasciaMuro, ZONE_PRIMA_LINEA, RETE_X, LINEA_TRE_METRI_A, LINEA_TRE_METRI_B, type MarkerCampo } from '@/domain/courtPositions';
import { puntoIncrocioRete } from '@/domain/analysis';

export type ModalitaCampo =
  | { tipo: 'inattivo' }
  | { tipo: 'seleziona-giocatore'; squadraAttiva: Squadra; onSeleziona: (giocatoreId: string) => void }
  | { tipo: 'seleziona-giocatore-prima-linea'; squadraAttiva: Squadra; onSeleziona: (giocatoreId: string) => void }
  | { tipo: 'seleziona-giocatore-entrambe'; onSeleziona: (giocatoreId: string, squadra: Squadra) => void }
  | { tipo: 'seleziona-punto'; onSeleziona: (punto: Punto) => void }
  | {
      tipo: 'seleziona-punto-con-fascia-muro';
      squadraAttaccante: Squadra;
      onSelezionaPunto: (punto: Punto) => void;
      onSelezionaMuro: (punto: Punto) => void;
    };

export type PosizioniCampo = { A?: Punto[]; B?: Punto[] };

function applicaPosizioni(marker: MarkerCampo[], posizioni?: Punto[]): MarkerCampo[] {
  if (!posizioni) return marker;
  return marker.map((m, indice) => (posizioni[indice] ? { ...m, ...posizioni[indice] } : m));
}

export interface Traiettoria {
  origine: Punto;
  destinazione: Punto;
  esito: 'punto_esecutore' | 'continua' | 'punto_avversario';
  toccoMuro?: boolean;
}

// Il campo reale e' 18x9m (rapporto 2:1): il viewBox riflette queste proporzioni
// perche' i marker dei giocatori (disegnati con <circle>) restino cerchi veri e
// non ellissi. Le coordinate di dominio (Punto, Azione.origine/destinazione)
// restano percentuali 0-100 su entrambi gli assi: solo il rendering qui dentro
// comprime l'asse y (larghezza campo) della meta' per adattarlo al viewBox
// 100x50. calcolaPunto lavora sempre in percentuali 0-100 sul riquadro reale
// dell'svg, quindi non serve alcuna conversione inversa.
const ALTEZZA_VIEWBOX = 50;
const vy = (y: number): number => (y / 100) * ALTEZZA_VIEWBOX;

// Margine sopra il campo riservato all'etichetta col nome del giocatore, che
// altrimenti verrebbe tagliata dal viewBox per i marker della fila piu' vicina
// al bordo superiore (vy minimo = 5). Il rettangolo del campo e le linee
// restano disegnati su 0..ALTEZZA_VIEWBOX: solo il viewBox dell'svg si estende.
const MARGINE_NOME = 7;

const COLORI_SQUADRA: Record<Squadra, { attivo: string; inattivo: string }> = {
  A: { attivo: '#2563eb', inattivo: '#1e3a5f' },
  B: { attivo: '#f97316', inattivo: '#7c4a1e' },
};

const COLORE_ESITO: Record<Traiettoria['esito'], string> = {
  punto_esecutore: '#000000',
  continua: '#22c55e',
  punto_avversario: '#ef4444',
};

function Marker({
  marker,
  squadra,
  attivo,
  onClick,
}: {
  marker: MarkerCampo;
  squadra: Squadra;
  attivo: boolean;
  onClick: () => void;
}) {
  const colore = attivo ? COLORI_SQUADRA[squadra].attivo : COLORI_SQUADRA[squadra].inattivo;
  return (
    <g
      data-testid={`giocatore-campo-${marker.giocatoreId}`}
      data-attivo={attivo}
      data-x={marker.x}
      data-y={marker.y}
      onClick={
        attivo
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      style={{
        cursor: attivo ? 'pointer' : 'default',
        transform: `translate(${marker.x}px, ${vy(marker.y)}px)`,
        transition: 'transform 450ms ease-in-out',
      }}
    >
      <circle
        cx={0}
        cy={0}
        r={4}
        fill={colore}
        stroke={attivo ? 'white' : 'none'}
        strokeWidth={attivo ? 0.6 : 0}
      />
      <text x={0} y={0} textAnchor="middle" dominantBaseline="central" fontSize={3.5} fill="white">
        {marker.numero}
      </text>
      <text
        x={0}
        y={-6}
        textAnchor="middle"
        fontSize={2.6}
        fill="white"
        stroke="#0f172a"
        strokeWidth={0.5}
        paintOrder="stroke"
      >
        {marker.nome}
      </text>
    </g>
  );
}

function marcatoreAttivo(modalita: ModalitaCampo, squadra: Squadra, marker: MarkerCampo): boolean {
  if (modalita.tipo === 'seleziona-giocatore') return modalita.squadraAttiva === squadra;
  if (modalita.tipo === 'seleziona-giocatore-entrambe') return true;
  if (modalita.tipo === 'seleziona-giocatore-prima-linea') {
    return modalita.squadraAttiva === squadra && (ZONE_PRIMA_LINEA as readonly number[]).includes(marker.zona);
  }
  return false;
}

export function CampoDaGioco({
  inCampoA,
  inCampoB,
  modalita,
  origineSelezionata,
  destinazioneSelezionata,
  ultimaTraiettoria,
  posizioni,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  modalita: ModalitaCampo;
  // Posizioni alternative per squadra (indice = zona - 1), per esempio lo
  // schema di ricezione/attacco; senza, i marker stanno sulla zona fissa.
  posizioni?: PosizioniCampo;
  origineSelezionata?: Punto | null;
  destinazioneSelezionata?: Punto | null;
  ultimaTraiettoria?: Traiettoria | null;
}) {
  const markerA = applicaPosizioni(costruisciMarker(inCampoA, 'A'), posizioni?.A);
  const markerB = applicaPosizioni(costruisciMarker(inCampoB, 'B'), posizioni?.B);
  const campoRectRef = useRef<SVGRectElement>(null);

  // Ancorato al <rect> del campo (0..100 x 0..ALTEZZA_VIEWBOX), non al bounding
  // box dell'intero svg: il viewBox dell'svg include anche il margine sopra
  // riservato ai nomi dei giocatori (MARGINE_NOME), che altrimenti sfalserebbe
  // il calcolo delle percentuali di dominio.
  function calcolaPunto(evento: MouseEvent<SVGElement>): Punto {
    const rect = campoRectRef.current!.getBoundingClientRect();
    const x = Math.round((((evento.clientX - rect.left) / rect.width) * 100) * 100) / 100;
    const y = Math.round((((evento.clientY - rect.top) / rect.height) * 100) * 100) / 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  }

  function handleClickCampo(evento: MouseEvent<SVGSVGElement>) {
    if (modalita.tipo === 'seleziona-punto') modalita.onSeleziona(calcolaPunto(evento));
    if (modalita.tipo === 'seleziona-punto-con-fascia-muro') modalita.onSelezionaPunto(calcolaPunto(evento));
  }

  function handleSeleziona(modalitaAttuale: ModalitaCampo, giocatoreId: string, squadra: Squadra) {
    if (modalitaAttuale.tipo === 'seleziona-giocatore' || modalitaAttuale.tipo === 'seleziona-giocatore-prima-linea') {
      modalitaAttuale.onSeleziona(giocatoreId);
    }
    if (modalitaAttuale.tipo === 'seleziona-giocatore-entrambe') {
      modalitaAttuale.onSeleziona(giocatoreId, squadra);
    }
  }

  const clickAbilitato = modalita.tipo === 'seleziona-punto' || modalita.tipo === 'seleziona-punto-con-fascia-muro';
  const fascia = modalita.tipo === 'seleziona-punto-con-fascia-muro' ? fasciaMuro(modalita.squadraAttaccante) : null;

  return (
    <div className="w-full min-h-0 flex-1 rounded-lg bg-slate-950 p-1">
      <svg
        data-testid="campo-da-gioco"
        viewBox={`0 -${MARGINE_NOME} 100 ${ALTEZZA_VIEWBOX + MARGINE_NOME}`}
        className="h-full w-full rounded bg-green-800"
        onClick={clickAbilitato ? handleClickCampo : undefined}
      >
        <rect ref={campoRectRef} x={0} y={0} width={100} height={ALTEZZA_VIEWBOX} fill="#c2410c" stroke="white" strokeWidth={0.6} />
        <line x1={LINEA_TRE_METRI_A} y1={0} x2={LINEA_TRE_METRI_A} y2={ALTEZZA_VIEWBOX} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
        <line x1={LINEA_TRE_METRI_B} y1={0} x2={LINEA_TRE_METRI_B} y2={ALTEZZA_VIEWBOX} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
        <line x1={RETE_X} y1={0} x2={RETE_X} y2={ALTEZZA_VIEWBOX} stroke="#fbbf24" strokeWidth={1} />
        {fascia && (
          <rect
            data-testid="fascia-muro"
            x={fascia.xMin}
            y={0}
            width={fascia.xMax - fascia.xMin}
            height={ALTEZZA_VIEWBOX}
            fill="rgba(34,211,238,0.55)"
            stroke="#0e7490"
            strokeWidth={0.4}
            onClick={(e) => {
              e.stopPropagation();
              if (modalita.tipo === 'seleziona-punto-con-fascia-muro') modalita.onSelezionaMuro(calcolaPunto(e));
            }}
          />
        )}
        {ultimaTraiettoria && (
          <g data-testid="ultima-traiettoria" opacity={0.6}>
            {ultimaTraiettoria.toccoMuro ? (
              (() => {
                const tocco = puntoIncrocioRete(ultimaTraiettoria.origine, ultimaTraiettoria.destinazione);
                return (
                  <>
                    <line
                      x1={ultimaTraiettoria.origine.x}
                      y1={vy(ultimaTraiettoria.origine.y)}
                      x2={tocco.x}
                      y2={vy(tocco.y)}
                      stroke={COLORE_ESITO[ultimaTraiettoria.esito]}
                      strokeWidth={0.6}
                      strokeDasharray="2,1.5"
                    />
                    <line
                      x1={tocco.x}
                      y1={vy(tocco.y)}
                      x2={ultimaTraiettoria.destinazione.x}
                      y2={vy(ultimaTraiettoria.destinazione.y)}
                      stroke={COLORE_ESITO[ultimaTraiettoria.esito]}
                      strokeWidth={0.6}
                      strokeDasharray="2,1.5"
                    />
                    <circle cx={tocco.x} cy={vy(tocco.y)} r={1} fill={COLORE_ESITO[ultimaTraiettoria.esito]} />
                  </>
                );
              })()
            ) : (
              <line
                x1={ultimaTraiettoria.origine.x}
                y1={vy(ultimaTraiettoria.origine.y)}
                x2={ultimaTraiettoria.destinazione.x}
                y2={vy(ultimaTraiettoria.destinazione.y)}
                stroke={COLORE_ESITO[ultimaTraiettoria.esito]}
                strokeWidth={0.6}
                strokeDasharray="2,1.5"
              />
            )}
            <circle cx={ultimaTraiettoria.origine.x} cy={vy(ultimaTraiettoria.origine.y)} r={1.2} fill={COLORE_ESITO[ultimaTraiettoria.esito]} />
            <circle cx={ultimaTraiettoria.destinazione.x} cy={vy(ultimaTraiettoria.destinazione.y)} r={1.8} fill={COLORE_ESITO[ultimaTraiettoria.esito]} />
          </g>
        )}
        {origineSelezionata && destinazioneSelezionata && (
          <line
            data-testid="traiettoria-in-corso"
            x1={origineSelezionata.x}
            y1={vy(origineSelezionata.y)}
            x2={destinazioneSelezionata.x}
            y2={vy(destinazioneSelezionata.y)}
            stroke="#f59e0b"
            strokeWidth={0.6}
            strokeDasharray="1.5,1"
          />
        )}
        {origineSelezionata && (
          <circle cx={origineSelezionata.x} cy={vy(origineSelezionata.y)} r={2} fill="#f59e0b" stroke="white" strokeWidth={0.4} />
        )}
        {destinazioneSelezionata && (
          <circle cx={destinazioneSelezionata.x} cy={vy(destinazioneSelezionata.y)} r={2} fill="#f59e0b" stroke="white" strokeWidth={0.4} />
        )}
        {markerA.map((m) => (
          <Marker
            key={m.giocatoreId}
            marker={m}
            squadra="A"
            attivo={marcatoreAttivo(modalita, 'A', m)}
            onClick={() => handleSeleziona(modalita, m.giocatoreId, 'A')}
          />
        ))}
        {markerB.map((m) => (
          <Marker
            key={m.giocatoreId}
            marker={m}
            squadra="B"
            attivo={marcatoreAttivo(modalita, 'B', m)}
            onClick={() => handleSeleziona(modalita, m.giocatoreId, 'B')}
          />
        ))}
      </svg>
    </div>
  );
}
