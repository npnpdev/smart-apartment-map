import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../constants';
import styles from './LoginPage.module.css';

export default function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Hasła nie są identyczne.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/password-reset/confirm/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token, new_password: newPassword }),
      });

      if (res.ok) {
        navigate('/login', { state: { message: 'Hasło zostało zmienione. Zaloguj się.' } });
      } else {
        const data = await res.json();
        const msg =
          data.token?.[0] ??
          data.new_password?.[0] ??
          data.detail ??
          'Wystąpił błąd.';
        setError(msg);
      }
    } catch {
      setError('Brak połączenia z serwerem.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.authCard}>
        <header className={styles.header}>
          <h1>Nowe hasło</h1>
          <p>Ustaw nowe hasło dla swojego konta.</p>
        </header>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <form className={styles.loginContainer} onSubmit={handleSubmit}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel} htmlFor="newPassword">Nowe hasło</label>
            <input
              id="newPassword"
              type="password"
              className={styles.loginInput}
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className={styles.loginField}>
            <label className={styles.loginLabel} htmlFor="confirmPassword">Potwierdź hasło</label>
            <input
              id="confirmPassword"
              type="password"
              className={styles.loginInput}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button className={styles.loginButton} disabled={loading}>
            {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
          </button>
        </form>
      </div>
    </div>
  );
}
