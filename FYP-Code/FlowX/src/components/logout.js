import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export const handleLogout = ({ setUsername, setRole, setPermissions, navigate, API_URL }) => {
  axios
    .get(`${API_URL}/logout`, { withCredentials: true })
    .then(() => {
      setUsername(null);
      setRole(null);
      setPermissions({});
      navigate('/login');
    })
    .catch((error) => {
      console.error("Error logging out", error);
    });
};
