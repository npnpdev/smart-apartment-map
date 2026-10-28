import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { API_BASE } from '../constants';
import styles from './LoginPage.module.css';

export default function DeleteAccountPage() {
  const { email, setEmail } = useAppContext();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const token = localStorage.getItem('AccessToken');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/me/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });

      if (res.status === 204) {
        localStorage.removeItem('AccessToken');
        if (email) localStorage.removeItem(`favorites_${email}`);
        setEmail('');
        navigate('/');
      } else {
        const data = await res.json();
        const msg = data.password?.[0] ?? data.detail ?? 'Wystąpił błąd.';
        setError(msg);
      }
    } catch {
      setError('Brak połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  }

  if (!email) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.authCard}>
          <header className={styles.header}>
            <h1>Brak dostępu</h1>
            <p>Musisz być zalogowany, aby usunąć konto.</p>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.authCard}>
        <header className={styles.header}>
          <h1>Usuń konto</h1>
          <p>
            Ta operacja jest <strong>nieodwracalna</strong>. Konto{' '}
            <strong>{email}</strong> zostanie trwale usunięte.
          </p>
        </header>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.loginContainer} onSubmit={handleDelete}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel} htmlFor="password">Potwierdź hasłem</label>
            <input
              id="password"
              type="password"
              className={styles.loginInput}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            className={styles.loginButton}
            disabled={loading}
            style={{ background: '#dc2626' }}
          >
            {loading ? 'Usuwanie...' : 'Usuń konto na stałe'}
          </button>
        </form>

        <div className={styles.toggleContainer}>
          <button className={styles.toggleBtn} onClick={() => navigate(-1)}>
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
