import ExcelJS from 'exceljs';
import { caricaRiepilogoPartita } from '@/db/matchSummary';
import { calcolaRigaGiocatore, type RigaStatisticheGiocatore } from '@/domain/statisticheComplete';
import type { Player } from '@/domain/types';

// Ogni voce e' un gruppo di colonne (un fondamentale) con le sue sotto-
// colonne: la riga 1 dello sheet unisce le celle del gruppo col nome del
// fondamentale, la riga 2 mostra le sotto-colonne, come nei referti
// Click&Scout allegati dall'utente.
const GRUPPI: { titolo: string; colonne: string[] }[] = [
  { titolo: 'Battuta', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Ricezione', colonne: ['Tot', 'Err', 'Pos%', 'Prf%'] },
  { titolo: 'Attacco', colonne: ['Tot', 'Err', 'Mur', 'Pt', 'Pt%', 'Eff%'] },
  { titolo: 'Attacco dopo Ricezione POS', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Attacco dopo Ricezione NEG', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Contrattacco', colonne: ['Tot', 'Err', 'Mur', 'Pt', 'Pt%', 'Eff%'] },
  { titolo: 'Muro', colonne: ['Tot', 'Err', 'Pt', 'Pt%'] },
  { titolo: 'Direzioni attacco', colonne: ['Par%', 'Diag%', 'Centro%'] },
];

const COLORE_INTESTAZIONE = 'FF1E3A5F';
const COLORE_SOTTOINTESTAZIONE = 'FFE2E8F0';

function valoriRiga(riga: RigaStatisticheGiocatore): (number | string)[] {
  const arrotonda = (n: number) => Math.round(n * 10) / 10;
  return [
    riga.battuta.tot, riga.battuta.err, riga.battuta.pt, arrotonda(riga.battuta.ptPercento),
    riga.ricezione.tot, riga.ricezione.err, arrotonda(riga.ricezione.posPercento), arrotonda(riga.ricezione.prfPercento),
    riga.attacco.tot, riga.attacco.err, riga.attacco.mur, riga.attacco.pt,
    arrotonda(riga.attacco.ptPercento), arrotonda(riga.attacco.efficienzaPercento),
    riga.attaccoDopoRicezionePositiva.tot, riga.attaccoDopoRicezionePositiva.err,
    riga.attaccoDopoRicezionePositiva.pt, arrotonda(riga.attaccoDopoRicezionePositiva.ptPercento),
    riga.attaccoDopoRicezioneNegativa.tot, riga.attaccoDopoRicezioneNegativa.err,
    riga.attaccoDopoRicezioneNegativa.pt, arrotonda(riga.attaccoDopoRicezioneNegativa.ptPercento),
    riga.contrattacco.tot, riga.contrattacco.err, riga.contrattacco.mur, riga.contrattacco.pt,
    arrotonda(riga.contrattacco.ptPercento), arrotonda(riga.contrattacco.efficienzaPercento),
    riga.muro.tot, riga.muro.err, riga.muro.pt, arrotonda(riga.muro.ptPercento),
    arrotonda(riga.direzioniAttacco.parallelaPercento), arrotonda(riga.direzioniAttacco.diagonalePercento),
    arrotonda(riga.direzioniAttacco.centroPercento),
  ];
}

function costruisciFoglioSquadra(workbook: ExcelJS.Workbook, nomeSquadra: string, giocatori: Player[], azioni: Parameters<typeof calcolaRigaGiocatore>[0]) {
  const sheet = workbook.addWorksheet(nomeSquadra.slice(0, 31) || 'Squadra');

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 18;
  let colonna = 3;
  for (const gruppo of GRUPPI) {
    const inizio = colonna;
    const fine = colonna + gruppo.colonne.length - 1;
    sheet.mergeCells(1, inizio, 1, fine);
    const celleTitolo = sheet.getCell(1, inizio);
    celleTitolo.value = gruppo.titolo;
    celleTitolo.alignment = { horizontal: 'center' };
    celleTitolo.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celleTitolo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORE_INTESTAZIONE } };
    for (let i = 0; i < gruppo.colonne.length; i += 1) {
      const cella = sheet.getCell(2, inizio + i);
      cella.value = gruppo.colonne[i];
      cella.font = { bold: true };
      cella.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORE_SOTTOINTESTAZIONE } };
      cella.alignment = { horizontal: 'center' };
      sheet.getColumn(inizio + i).width = 7;
    }
    colonna = fine + 1;
  }
  sheet.getCell(1, 1).value = '#';
  sheet.getCell(1, 2).value = 'Giocatore';
  sheet.mergeCells(1, 1, 2, 1);
  sheet.mergeCells(1, 2, 2, 2);
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 18;

  let rigaIndice = 3;
  for (const giocatore of giocatori) {
    const riga = calcolaRigaGiocatore(azioni, giocatore.id);
    sheet.getCell(rigaIndice, 1).value = giocatore.numero;
    sheet.getCell(rigaIndice, 2).value = giocatore.nome;
    const valori = valoriRiga(riga);
    valori.forEach((v, i) => {
      sheet.getCell(rigaIndice, 3 + i).value = v;
    });
    rigaIndice += 1;
  }

  sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 2 }];
  return sheet;
}

export async function generaXlsxReport(matchId: string): Promise<Blob> {
  const { match, giocatori, riepiloghi, tutteLeAzioni } = await caricaRiepilogoPartita(matchId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Scouting Pallavolo';
  workbook.created = new Date();

  const riepilogo = workbook.addWorksheet('Riepilogo');
  riepilogo.getColumn(1).width = 14;
  riepilogo.getColumn(2).width = 10;
  riepilogo.getCell(1, 1).value = `Report partita — ${match.data}`;
  riepilogo.getCell(1, 1).font = { bold: true, size: 14 };
  riepilogo.getCell(2, 1).value = 'Set';
  riepilogo.getCell(2, 2).value = 'Punteggio';
  riepilogo.getRow(2).font = { bold: true };
  riepiloghi.forEach(({ set, punteggioA, punteggioB }, indice) => {
    riepilogo.getCell(3 + indice, 1).value = `Set ${set.numero}`;
    riepilogo.getCell(3 + indice, 2).value = `${punteggioA} - ${punteggioB}`;
  });

  const giocatoriA = giocatori.filter((g) => g.teamId === match.squadraAId);
  const giocatoriB = giocatori.filter((g) => g.teamId === match.squadraBId);
  costruisciFoglioSquadra(workbook, 'Squadra A', giocatoriA, tutteLeAzioni);
  costruisciFoglioSquadra(workbook, 'Squadra B', giocatoriB, tutteLeAzioni);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function scaricaXlsx(nomeFile: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeFile;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
