import { useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE } from '../constants';
import styles from './LoginPage.module.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/password-reset/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json();
        const msg = data.email?.[0] ?? 'Wystąpił błąd.';
        setError(msg);
      } else {
        setSubmitted(true);
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
          <h1>Reset hasła</h1>
          <p>Podaj adres email — wyślemy link do zmiany hasła.</p>
        </header>

        {submitted ? (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            <p>Jeśli konto o tym adresie istnieje, wysłaliśmy link do resetu hasła.</p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Sprawdź skrzynkę (i folder spam). Link ważny 1 godzinę.
            </p>
            <Link to="/login" className={styles.toggleBtn} style={{ display: 'inline-block', marginTop: '1.5rem' }}>
              Wróć do logowania
            </Link>
          </div>
        ) : (
          <>
            {error && <div className={styles.errorMessage}>{error}</div>}
            <form className={styles.loginContainer} onSubmit={handleSubmit}>
              <div className={styles.loginField}>
                <label className={styles.loginLabel} htmlFor="email">Adres Email</label>
                <input
                  id="email"
                  type="email"
                  className={styles.loginInput}
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button className={styles.loginButton} disabled={loading}>
                {loading ? 'Wysyłanie...' : 'Wyślij link resetujący'}
              </button>
            </form>
            <div className={styles.toggleContainer}>
              <span className={styles.toggleText}>Pamiętasz hasło?</span>
              <Link to="/login" className={styles.toggleBtn}>Zaloguj się</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
