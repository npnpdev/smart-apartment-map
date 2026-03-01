import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function LogoutPage() {
  const { setEmail } = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    setEmail(null);
    navigate('/');
  }, []);

  return null;
}
