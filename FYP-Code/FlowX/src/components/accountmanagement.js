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

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();

        if (passwords.newPassword === passwords.currentPassword) {
            return { success: false, message: 'New password can\'t be the same as the old password' };
        }

        if (passwords.newPassword !== passwords.confirmNewPassword) {
            return { success: false, message: 'New passwords do not match' };
        }

        try {
            const response = await axios.post(`${API_URL}/change-password`, {
                currentPassword: passwords.currentPassword,
                newPassword: passwords.newPassword
            }, { withCredentials: true });

            if (response.status === 200) {
                return { success: true, message: response.data.message };
            } else {
                return { success: false, message: response.data.message };
            }
        } catch (error) {
            const message = error.response?.data?.message || 'Error changing password.';
            console.error("Error changing password", error);
            return { success: false, message };
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
    };
};

export default useAccountManagementController;
