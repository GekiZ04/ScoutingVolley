import { useRegisterSW } from 'virtual:pwa-register/react';

// Il plugin PWA usa registerType 'prompt': senza questo componente un
// deploy nuovo resta "in attesa" e il service worker vecchio continua a
// servire i bundle in cache finche' l'utente non chiude del tutto l'app -
// causa di segnalazioni di bug gia' risolti che "non si vedono".
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      data-testid="banner-nuova-versione"
      className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-between gap-3 bg-blue-700 px-4 py-3 text-sm text-white"
    >
      <span>Nuova versione disponibile.</span>
      <button
        type="button"
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-white px-4 py-1.5 font-semibold text-blue-700"
      >
        Aggiorna
      </button>
    </div>
  );
}
