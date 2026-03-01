import { useEffect } from 'react';
import { Form, useActionData, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

import SidePanel from '../components/SidePanel/SidePanel.tsx';
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

  console.log(actionData);

  useEffect(() => {
    if (actionData?.email && actionData?.token) {
      setEmail(actionData.email);
      localStorage.setItem('AccessToken', actionData.token);
      navigate('/');
    }
  }, [actionData]);

  return (
    <SidePanel side="left" title="Logowanie" width={400}>
      <Form method="post">
        <div className={styles.loginContainer}>
          <div className={styles.loginField}>
            <label className={styles.loginLabel} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className={styles.loginInput}
              placeholder="twoj@email.com"
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
            />
          </div>
          <button className={styles.loginButton}>'Zaloguj'</button>
        </div>
      </Form>
    </SidePanel>
  );
}

export async function action({ request }: { request: Request }) {
  console.log('login action');
  const formData = await request.formData();
  const username = formData.get('email') as string;
  const password = formData.get('password') as string;

  /* tu zmienić na wywołanie backend
  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    return { error: 'Invalid credentials' };
  }
  const data = await response.json();
  */

  const data = {
    email: username,
    token: 'ABC123' + password, // zmienić na token autentykacyjny zwracany przez backend
  };

  return data;
}
