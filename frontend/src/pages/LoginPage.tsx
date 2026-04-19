import { useEffect, useState } from 'react';
import { Form, useActionData, useNavigate, useNavigation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import styles from './LoginPage.module.css';

type ActionData = {
  email?: string;
  token?: string;
  error?: string;
};

export default function LoginPage() {
  const actionData = useActionData() as ActionData;
  const { setEmail } = useAppContext();
  const navigate = useNavigate();
  const navigation = useNavigation();
  
  const isSubmitting = navigation.state === 'submitting';
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    if (actionData?.email && actionData?.token) {
      setEmail(actionData.email);
      localStorage.setItem('AccessToken', actionData.token);
      // Cofa do poprzedniej strony (np. na mapę, jeśli stamtąd przyszliśmy)
      navigate(-1);
    }
  },[actionData, navigate, setEmail]);

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.authCard}>
        
        <button 
          className={styles.closeButton} 
          onClick={() => navigate(-1)} // Cofa zamiast wrzucać na Home
          aria-label="Zamknij i wróć"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <header className={styles.header}>
          <h1>{isLogin ? 'Witaj ponownie' : 'Stwórz konto'}</h1>
          <p>
            {isLogin 
              ? 'Zaloguj się, aby kontynuować' 
              : 'Zyskaj pełen dostęp do platformy analitycznej'}
          </p>
        </header>

        {actionData?.error && (
          <div className={styles.errorMessage}>
            {actionData.error}
          </div>
        )}

        <Form method="post" className={styles.loginContainer}>
          <input type="hidden" name="mode" value={isLogin ? 'login' : 'register'} />

          <div className={styles.loginField}>
            <label className={styles.loginLabel} htmlFor="email">
              Adres Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.loginInput}
              placeholder="name@example.com"
              required
            />
          </div>
          
          <div className={styles.loginField}>
            <label className={styles.loginLabel} htmlFor="password">
              Hasło
            </label>
            <input
              id="password"
              name="password"
              className={styles.loginInput}
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          {!isLogin && (
            <div className={styles.loginField}>
              <label className={styles.loginLabel} htmlFor="confirmPassword">
                Potwierdź hasło
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                className={styles.loginInput}
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
          )}

          <button 
            className={styles.loginButton} 
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? 'Przetwarzanie...' 
              : (isLogin ? 'Zaloguj się' : 'Zarejestruj się')
            }
          </button>
        </Form>

        <div className={styles.toggleContainer}>
          <span className={styles.toggleText}>
            {isLogin ? 'Nie masz jeszcze konta?' : 'Masz już konto?'}
          </span>
          <button 
            type="button" 
            onClick={() => setIsLogin(!isLogin)} 
            className={styles.toggleBtn}
          >
            {isLogin ? 'Zarejestruj się' : 'Zaloguj się'}
          </button>
        </div>

      </div>
    </div>
  );
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  
  const mode = formData.get('mode') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  try {
    // 1. OBSŁUGA REJESTRACJI
    if (mode === 'register') {
      if (password !== confirmPassword) {
        return { error: 'Hasła nie są identyczne!' };
      }

      const registerRes = await fetch('http://localhost:8000/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email, 
          username: email, 
          password: password 
        }), 
      });

      if (!registerRes.ok) {
        const errorData = await registerRes.json();
        
        // Wyciągamy treść błędu
        const firstKey = Object.keys(errorData)[0];
        let errorMessage = errorData[firstKey];
        if (Array.isArray(errorMessage)) errorMessage = errorMessage[0];
        
        // Sprawdzamy, czy błąd wynika z tego, że użytkownik już istnieje
        const isUserExistsError = errorMessage && (
            errorMessage.includes("unique") || 
            errorMessage.includes("exists") ||
            errorMessage.includes("istnieje")
        );

        // Jeśli to inny błąd (np. słabe hasło), przerywamy i wyświetlamy go
        if (!isUserExistsError) {
           if (errorMessage.includes("similar")) return { error: "Hasło nie może być podobne do emaila." };
           if (errorMessage.includes("common")) return { error: "To hasło jest zbyt pospolite." };
           if (errorMessage.includes("characters")) return { error: "Hasło jest za krótkie." };
           return { error: errorMessage };
        }
        
        // Jeśli błąd to "użytkownik istnieje", kod idzie dalej -> do automatycznego logowania
      }
    }

    // 2. OBSŁUGA LOGOWANIA
    const loginRes = await fetch('http://localhost:8000/api/auth/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email, 
        username: email, 
        password: password 
      }),
    });

    if (!loginRes.ok) {
      if (loginRes.status === 401) {
        return { error: 'Nieprawidłowy email lub hasło.' };
      }
      return { error: 'Wystąpił problem podczas logowania.' };
    }

    const data = await loginRes.json();
    
    return {
      email: email,
      token: data.access, 
    };

  } catch (error) {
    return { error: 'Brak połączenia z serwerem.' };
  }
}