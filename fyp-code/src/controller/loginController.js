import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const useLoginController = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const navigate = useNavigate();

  const handleUsernameChange = (e) => setUsername(e.target.value);
  const handlePasswordChange = (e) => setPassword(e.target.value);

  const handleSubmit = (e) => {
    e.preventDefault();

    axios.post('http://localhost:5000/login', {
      username: username,
      password: password
    }, { withCredentials: true })
    .then((response) => {
      if (response.data.status === 'success') {
        setErrorMessage('');
        navigate('/'); // Redirect to home
      } else {
        setErrorMessage(response.data.message);
      }
    })
    .catch((error) => {
      console.error("Error logging in:", error);
      setErrorMessage('An error occurred. Please try again.');
    });
  };

  return {
    username,
    password,
    errorMessage,
    handleUsernameChange,
    handlePasswordChange,
    handleSubmit
  };
};

export default useLoginController;
