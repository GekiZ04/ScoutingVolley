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

function calcolaPunto(evento: MouseEvent<SVGSVGElement>): Punto {
  const rect = evento.currentTarget.getBoundingClientRect();
  const x = Math.round((((evento.clientX - rect.left) / rect.width) * 100) * 100) / 100;
  const y = Math.round((((evento.clientY - rect.top) / rect.height) * 100) * 100) / 100;
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function Marker({ marker, attivo, onClick }: { marker: MarkerCampo; attivo: boolean; onClick: () => void }) {
  return (
    <g
      data-testid={`giocatore-campo-${marker.giocatoreId}`}
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
      <circle cx={marker.x} cy={marker.y} r={4} fill={attivo ? '#2563eb' : '#64748b'} />
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
}: {
  inCampoA: Player[];
  inCampoB: Player[];
  modalita: ModalitaCampo;
  origineSelezionata?: Punto | null;
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
    <svg
      data-testid="campo-da-gioco"
      viewBox="0 0 100 100"
      className="w-full flex-1 rounded-lg bg-emerald-900"
      onClick={clickAbilitato ? handleClickCampo : undefined}
    >
      <rect x={0} y={0} width={100} height={100} fill="none" stroke="white" strokeWidth={0.5} />
      <line x1={50} y1={0} x2={50} y2={100} stroke="white" strokeWidth={0.8} />
      <line x1={16.67} y1={0} x2={16.67} y2={100} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
      <line x1={83.33} y1={0} x2={83.33} y2={100} stroke="white" strokeWidth={0.3} strokeDasharray="1,1" />
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
      {origineSelezionata && <circle cx={origineSelezionata.x} cy={origineSelezionata.y} r={2} fill="yellow" />}
      {markerA.map((m) => (
        <Marker
          key={m.giocatoreId}
          marker={m}
          attivo={modalita.tipo === 'seleziona-giocatore' && modalita.squadraAttiva === 'A'}
          onClick={() => modalita.tipo === 'seleziona-giocatore' && modalita.onSeleziona(m.giocatoreId)}
        />
      ))}
      {markerB.map((m) => (
        <Marker
          key={m.giocatoreId}
          marker={m}
          attivo={modalita.tipo === 'seleziona-giocatore' && modalita.squadraAttiva === 'B'}
          onClick={() => modalita.tipo === 'seleziona-giocatore' && modalita.onSeleziona(m.giocatoreId)}
        />
      ))}
    </svg>
  );
}
