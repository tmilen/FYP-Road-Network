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

    const validatePassword = (password) => {
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        return password.length >= 8 && hasSpecialChar;
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post(`${API_URL}/change-password`, {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            }, { withCredentials: true });

            return {
                success: response.status === 200,
                message: response.data.message
            };
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Error changing password'
            };
        }
    };

    return {
        userData,
        showPasswordForm,
        passwords,
        setShowPasswordForm,
        handlePasswordChange,
        handlePasswordSubmit,
        setPasswords,
        validatePassword,
    };
};

export default useAccountManagementController;
