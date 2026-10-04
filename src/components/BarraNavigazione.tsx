import { Link, useLocation, useNavigate } from 'react-router-dom';

const CLASSE = 'text-sm text-slate-400 hover:text-white';

// location.key === 'default' = prima voce della cronologia (pagina aperta
// direttamente o da un reload): navigate(-1) uscirebbe dall'app.
export function BarraNavigazione() {
  const navigate = useNavigate();
  const location = useLocation();
  const haCronologia = location.key !== 'default';

  return (
    <nav className="mb-4 flex gap-4">
      <button type="button" onClick={() => (haCronologia ? navigate(-1) : navigate('/'))} className={CLASSE}>
        ← Indietro
      </button>
      <Link to="/" className={CLASSE}>
        ← Home
      </Link>
    </nav>
  );
}
