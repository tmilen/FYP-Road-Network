import { useState, useEffect } from 'react';
import axios from 'axios';

const useAccountManagementController = () => {
    const [userData, setUserData] = useState({
        username: '',
        first_name: '',
        last_name: '',
        email: '',
        date_of_birth: '',
        role: ''
    });

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
    });

    const [message, setMessage] = useState(null);
    const [success, setSuccess] = useState(false);

    const API_URL = process.env.REACT_APP_API_URL; // Load API URL from .env

    useEffect(() => {
        axios.get(`${API_URL}/session`, { withCredentials: true })
            .then(response => {
                setUserData(response.data);
            })
            .catch(error => {
                console.error("Error fetching user data", error);
            });
    }, [API_URL]);

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswords({ ...passwords, [name]: value });
    };

    const handlePasswordSubmit = (e) => {
        e.preventDefault();

        if (passwords.newPassword === passwords.currentPassword) {
            setMessage('New password can\'t be the same as the old password');
            setSuccess(false);
            return;
        }

        if (passwords.newPassword !== passwords.confirmNewPassword) {
            setMessage('New passwords do not match');
            setSuccess(false);
            return;
        }

        axios.post(`${API_URL}/change-password`, {
            currentPassword: passwords.currentPassword,
            newPassword: passwords.newPassword
        }, { withCredentials: true })
            .then(response => {
                setMessage(response.data.message);
                if (response.status === 200) {
                    setSuccess(true);
                    setPasswords({
                        currentPassword: '',
                        newPassword: '',
                        confirmNewPassword: ''
                    });
                } else {
                    setSuccess(false);
                }
            })
            .catch(error => {
                if (error.response && error.response.data && error.response.data.message) {
                    setMessage(error.response.data.message);
                } else {
                    setMessage('Error changing password.');
                }
                setSuccess(false);
                console.error("Error changing password", error);
            });
    };

    return {
        userData,
        showPasswordForm,
        passwords,
        message,
        success,
        setShowPasswordForm,
        handlePasswordChange,
        handlePasswordSubmit,
        setPasswords, // Ensure setPasswords is returned
        setMessage, // Ensure setMessage is returned
    };
};

export default useAccountManagementController;
