import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function LogoutPage() {
  const { setEmail, clearChat } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    setEmail(null);
    // na wspólnym komputerze kolejna osoba nie powinna widzieć rozmowy
    clearChat();
    navigate('/');
  }, []);

  return null;
}
