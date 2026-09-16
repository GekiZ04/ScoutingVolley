import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, configure, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db/schema';
import { useLiveMatchStore } from '@/store/liveMatchStore';
import { routes } from '@/app/router';

// Ogni schermata di questo test dipende dalla propagazione asincrona delle
// live query di Dexie (fake-indexeddb). Il default di 1s di RTL è a volte
// troppo stretto in un ambiente di CI sotto carico su un flusso lungo come
// questo: alza il timeout globale di attesa per ridurre la flakiness.
configure({ asyncUtilTimeout: 5000 });

/**
 * Test di integrazione end-to-end: monta l'app reale con lo stesso array di
 * route usato in produzione (src/app/router.tsx) e percorre il flusso utente
 * completo — crea due squadre con roster, imposta una partita, sceglie le
 * formazioni, registra un'azione a punteggio live, chiude set e partita,
 * poi verifica che lo storico e il report mostrino il punteggio corretto.
 * Usa MemoryRouter + Routes anziché il createBrowserRouter di produzione (o
 * createMemoryRouter): i router "data" di react-router v6 usano l'API
 * Request/AbortSignal nativa per ogni navigazione e non funzionano in modo
 * affidabile sotto jsdom/vitest (mismatch fra gli AbortSignal di jsdom e
 * quelli di undici in Node). Le pagine e i path sono comunque gli stessi
 * esportati da app/router.tsx (routes), quindi il test esercita la stessa
 * composizione di pagine dell'app reale.
 * Non copre ogni schermata: prova solo che i pezzi siano davvero collegati.
 */
async function aggiungiSeiGiocatori(user: ReturnType<typeof userEvent.setup>, prefisso: string) {
  for (let i = 1; i <= 6; i += 1) {
    const numeroInput = screen.getByPlaceholderText('Numero');
    const nomeInput = screen.getByPlaceholderText('Nome giocatore');
    await user.clear(numeroInput);
    await user.type(numeroInput, String(i));
    await user.type(nomeInput, `${prefisso}${i}`);
    await user.click(screen.getByRole('button', { name: 'Aggiungi' }));
    await screen.findByText(new RegExp(`#${i} ${prefisso}${i}`));
  }
}

function contenitoreFormazione(etichetta: RegExp) {
  const titolo = screen.getByText(etichetta);
  const contenitore = titolo.closest('div');
  if (!contenitore) throw new Error(`Contenitore non trovato per ${etichetta}`);
  return contenitore;
}

async function scegliFormazioneCompleta(user: ReturnType<typeof userEvent.setup>) {
  const colonnaA = contenitoreFormazione(/Squadra A \(0\/6\)/);
  // Il roster viene caricato in modo asincrono da Dexie: attende che i
  // pulsanti dei 6 giocatori compaiano prima di cliccarli.
  const bottoniA = await within(colonnaA).findAllByRole('button');
  expect(bottoniA).toHaveLength(6);
  for (const bottone of bottoniA) {
    await user.click(bottone);
  }
  const colonnaB = contenitoreFormazione(/Squadra B \(0\/6\)/);
  const bottoniB = await within(colonnaB).findAllByRole('button');
  expect(bottoniB).toHaveLength(6);
  for (const bottone of bottoniB) {
    await user.click(bottone);
  }
  await user.click(screen.getByRole('button', { name: 'Inizia partita' }));
}

describe('App (integrazione end-to-end)', () => {
  beforeEach(async () => {
    await db.teams.clear();
    await db.players.clear();
    await db.matches.clear();
    await db.sets.clear();
    await db.rallies.clear();
    await db.azioni.clear();
    await db.sostituzioni.clear();
    await db.timeouts.clear();
    useLiveMatchStore.setState({ set: null, rallies: [], azioni: [], sostituzioni: [], timeouts: [] });
  });

  it('percorre il flusso completo: squadre, partita, scouting live, chiusura e report', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          {routes.map((r) => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
        </Routes>
      </MemoryRouter>,
    );

    // Home -> Squadre -> crea Volley Rossi -> roster -> Home
    await user.click(await screen.findByRole('link', { name: 'Squadre' }));
    await user.type(screen.getByPlaceholderText('Nome squadra'), 'Volley Rossi');
    await user.click(screen.getByRole('button', { name: 'Crea squadra' }));
    await user.click(await screen.findByRole('link', { name: 'Volley Rossi' }));
    await aggiungiSeiGiocatori(user, 'A');
    await user.click(screen.getByRole('link', { name: '← Home' }));

    // Home -> Squadre -> crea Volley Blu -> roster -> Home
    await user.click(await screen.findByRole('link', { name: 'Squadre' }));
    await user.type(screen.getByPlaceholderText('Nome squadra'), 'Volley Blu');
    await user.click(screen.getByRole('button', { name: 'Crea squadra' }));
    await user.click(await screen.findByRole('link', { name: 'Volley Blu' }));
    await aggiungiSeiGiocatori(user, 'B');
    await user.click(screen.getByRole('link', { name: '← Home' }));

    // Home -> Nuova partita
    await user.click(await screen.findByRole('link', { name: 'Nuova partita' }));
    await user.selectOptions(screen.getByLabelText('Squadra A'), 'Volley Rossi');
    await user.selectOptions(screen.getByLabelText('Squadra B'), 'Volley Blu');
    await user.click(screen.getByRole('button', { name: 'Continua alla formazione' }));

    // Formazione set 1
    await screen.findByText('Formazione titolare');
    await scegliFormazioneCompleta(user);

    // Live scouting set 1: registra una battuta vincente (ace)
    await screen.findByText('Flottante');
    await user.click(screen.getByText('Flottante'));
    await user.click(screen.getByText('#'));
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 10, clientY: 50 });
    fireEvent.click(screen.getByTestId('campo-da-gioco'), { clientX: 90, clientY: 50 });
    await waitFor(() => expect(screen.getByTestId('punteggio')).toHaveTextContent('1 : 0'));

    // Chiudi il set 1 (score 1-0, quindi permesso) -> torna alla formazione per il set 2
    await user.click(screen.getByRole('button', { name: 'Chiudi set' }));
    await screen.findByText('Formazione titolare');

    // Formazione set 2
    await scegliFormazioneCompleta(user);

    // Live scouting set 2: chiudi direttamente la partita
    await screen.findByTestId('punteggio');
    await user.click(screen.getByRole('button', { name: 'Chiudi partita' }));

    // Storico -> apri il report della partita conclusa
    await screen.findByText('Storico partite');
    const vociPartita = await screen.findByText(/Volley Rossi vs Volley Blu \(conclusa\)/);
    await user.click(vociPartita);

    expect(await screen.findByTestId('riepilogo-set-1')).toHaveTextContent('Set 1: 1 - 0');
  }, 30000);
});
