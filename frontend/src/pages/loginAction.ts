import { API_BASE } from '../constants';

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();

  const mode = formData.get('mode') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  try {
    if (mode === 'register') {
      if (password !== confirmPassword) {
        return { error: 'Hasła nie są identyczne!' };
      }

      const registerRes = await fetch(`${API_BASE}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username: email, password }),
      });

      if (!registerRes.ok) {
        const errorData = await registerRes.json();
        const firstKey = Object.keys(errorData)[0];
        let errorMessage = errorData[firstKey];
        if (Array.isArray(errorMessage)) errorMessage = errorMessage[0];

        const isUserExistsError = errorMessage && (
          errorMessage.includes("unique") ||
          errorMessage.includes("exists") ||
          errorMessage.includes("istnieje")
        );

        if (!isUserExistsError) {
          if (errorMessage.includes("similar")) return { error: "Hasło nie może być podobne do emaila." };
          if (errorMessage.includes("common")) return { error: "To hasło jest zbyt pospolite." };
          if (errorMessage.includes("characters")) return { error: "Hasło jest za krótkie." };
          return { error: errorMessage };
        }
      }
    }

    const loginRes = await fetch(`${API_BASE}/api/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username: email, password }),
    });

    if (!loginRes.ok) {
      if (loginRes.status === 401) {
        return { error: 'Nieprawidłowy email lub hasło.' };
      }
      return { error: 'Wystąpił problem podczas logowania.' };
    }

    const data = await loginRes.json();
    return { email, token: data.access };

  } catch {
    return { error: 'Brak połączenia z serwerem.' };
  }
}
