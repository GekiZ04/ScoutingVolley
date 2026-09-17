import type { MouseEvent } from 'react';
import type { Player, Punto, Squadra } from '@/domain/types';
import { costruisciMarker, fasciaMuro, type MarkerCampo } from '@/domain/courtPositions';

export type ModalitaCampo =
  | { tipo: 'inattivo' }
  | { tipo: 'seleziona-giocatore'; squadraAttiva: Squadra; onSeleziona: (giocatoreId: string) => void }
  | { tipo: 'seleziona-punto'; onSeleziona: (punto: Punto) => void }
  | {
      tipo: 'seleziona-punto-con-fascia-muro';
      squadraAttaccante: Squadra;
      onSelezionaPunto: (punto: Punto) => void;
      onSelezionaMuro: () => void;
    };

export interface Traiettoria {
  origine: Punto;
  destinazione: Punto;
}

const COLORI_SQUADRA: Record<Squadra, { attivo: string; inattivo: string }> = {
  A: { attivo: '#2563eb', inattivo: '#1e3a5f' },
  B: { attivo: '#f97316', inattivo: '#7c4a1e' },
};

function calcolaPunto(evento: MouseEvent<SVGSVGElement>): Punto {
  const rect = evento.currentTarget.getBoundingClientRect();
  const x = Math.round((((evento.clientX - rect.left) / rect.width) * 100) * 100) / 100;
  const y = Math.round((((evento.clientY - rect.top) / rect.height) * 100) * 100) / 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

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
      onClick={
        attivo
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      style={{ cursor: attivo ? 'pointer' : 'default' }}
    >
      <circle
        cx={marker.x}
        cy={marker.y}
        r={4}
        fill={colore}
        stroke={attivo ? 'white' : 'none'}
        strokeWidth={attivo ? 0.6 : 0}
      />
      <text x={marker.x} y={marker.y} textAnchor="middle" dominantBaseline="central" fontSize={3.5} fill="white">
        {marker.numero}
      </text>
    </g>
  );
}

export function CampoDaGioco({
  inCampoA,
  inCampoB,
  modalita,
  origineSelezionata,
  ultimaTraiettoria,
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  modalita: ModalitaCampo;
  origineSelezionata?: Punto | null;
  ultimaTraiettoria?: Traiettoria | null;
}) {
  const markerA = costruisciMarker(inCampoA, 'A');
  const markerB = costruisciMarker(inCampoB, 'B');

  function handleClickCampo(evento: MouseEvent<SVGSVGElement>) {
    if (modalita.tipo === 'seleziona-punto') modalita.onSeleziona(calcolaPunto(evento));
    if (modalita.tipo === 'seleziona-punto-con-fascia-muro') modalita.onSelezionaPunto(calcolaPunto(evento));
  }

  const clickAbilitato = modalita.tipo === 'seleziona-punto' || modalita.tipo === 'seleziona-punto-con-fascia-muro';
  const fascia = modalita.tipo === 'seleziona-punto-con-fascia-muro' ? fasciaMuro(modalita.squadraAttaccante) : null;

  return (
    <div className="w-full flex-1 rounded-lg bg-slate-950 p-2">
      <svg
        data-testid="campo-da-gioco"
        viewBox="0 0 100 100"
        className="h-full w-full rounded bg-cyan-800"
        onClick={clickAbilitato ? handleClickCampo : undefined}
      >
        <rect x={0} y={0} width={100} height={100} fill="none" stroke="white" strokeWidth={0.6} />
        <line x1={16.67} y1={0} x2={16.67} y2={100} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
        <line x1={83.33} y1={0} x2={83.33} y2={100} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
        <line x1={50} y1={0} x2={50} y2={100} stroke="#fbbf24" strokeWidth={1} />
        {fascia && (
          <rect
            data-testid="fascia-muro"
            x={fascia.xMin}
            y={0}
            width={fascia.xMax - fascia.xMin}
            height={100}
            fill="rgba(220,38,38,0.35)"
            onClick={(e) => {
              e.stopPropagation();
              if (modalita.tipo === 'seleziona-punto-con-fascia-muro') modalita.onSelezionaMuro();
            }}
          />
        )}
        {ultimaTraiettoria && (
          <g data-testid="ultima-traiettoria" opacity={0.6}>
            <line
              x1={ultimaTraiettoria.origine.x}
              y1={ultimaTraiettoria.origine.y}
              x2={ultimaTraiettoria.destinazione.x}
              y2={ultimaTraiettoria.destinazione.y}
              stroke="white"
              strokeWidth={0.6}
              strokeDasharray="2,1.5"
            />
            <circle cx={ultimaTraiettoria.origine.x} cy={ultimaTraiettoria.origine.y} r={1.2} fill="white" />
            <circle cx={ultimaTraiettoria.destinazione.x} cy={ultimaTraiettoria.destinazione.y} r={1.8} fill="white" />
          </g>
        )}
        {origineSelezionata && (
          <circle cx={origineSelezionata.x} cy={origineSelezionata.y} r={2} fill="#f59e0b" stroke="white" strokeWidth={0.4} />
        )}
        {markerA.map((m) => (
          <Marker
            key={m.giocatoreId}
            marker={m}
            squadra="A"
            attivo={modalita.tipo === 'seleziona-giocatore' && modalita.squadraAttiva === 'A'}
            onClick={() => modalita.tipo === 'seleziona-giocatore' && modalita.onSeleziona(m.giocatoreId)}
          />
        ))}
        {markerB.map((m) => (
          <Marker
            key={m.giocatoreId}
            marker={m}
            squadra="B"
            attivo={modalita.tipo === 'seleziona-giocatore' && modalita.squadraAttiva === 'B'}
            onClick={() => modalita.tipo === 'seleziona-giocatore' && modalita.onSeleziona(m.giocatoreId)}
          />
        ))}
      </svg>
    </div>
  );
}
