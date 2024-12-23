import React from 'react';
import Navbar from './navbar';
import { IoIosClose } from "react-icons/io";
import useAccountManagementController from '../components/accountmanagement'; 
import styles from '../css/accountmanagement.module.css'; 

const AccountManagement = () => {
    const {
        userData,
        showPasswordForm,
        passwords,
        message,
        success,
        setShowPasswordForm,
        handlePasswordChange,
        handlePasswordSubmit,
        setPasswords, // Ensure setPasswords is destructured
        setMessage, // Ensure setMessage is destructured
    } = useAccountManagementController(); 

    const handleClear = () => {
        setPasswords({
            currentPassword: '',
            newPassword: '',
            confirmNewPassword: ''
        });
        setMessage(null); // Clear the error message
    };

    const formatRole = (role) => {
        return role
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    return (
        <div>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />

            <div className={styles.accountManagementContainer}>
                <div className={styles.accountBox}>
                    <h2>Account Details</h2>
                    <p><strong>Username:</strong> {userData.username}</p>
                    <p><strong>First Name:</strong> {userData.first_name}</p>
                    <p><strong>Last Name:</strong> {userData.last_name}</p>
                    <p><strong>Email:</strong> {userData.email}</p>
                    <p><strong>Date of Birth:</strong> {userData.date_of_birth}</p>
                    <p><strong>Role:</strong> {formatRole(userData.role)}</p>
                    <button onClick={() => setShowPasswordForm(!showPasswordForm)} className={styles.changePasswordButton}>
                        Change Password
                    </button>
                </div>

                {showPasswordForm && (
                    <div className={styles.passwordFormContainer}>
                        <div className={styles.passwordFormHeader}>
                            <h3>Change Password</h3>
                            <button onClick={() => setShowPasswordForm(false)} className={styles.closePasswordForm}>
                                <IoIosClose />
                            </button>
                        </div>
                        <form onSubmit={handlePasswordSubmit}>
                            <div className={styles.inputGroup}>
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    value={passwords.currentPassword}
                                    onChange={handlePasswordChange}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>New Password</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={passwords.newPassword}
                                    onChange={handlePasswordChange}
                                    required
                                />
                            </div>
                            <div className={styles.inputGroup}>
                                <label>Confirm New Password</label>
                                <input
                                    type="password"
                                    name="confirmNewPassword"
                                    value={passwords.confirmNewPassword}
                                    onChange={handlePasswordChange}
                                    required
                                />
                            </div>
                            <div className={styles.buttonGroup}>
                                <button type="submit" className={styles.changePasswordSubmit}>Submit</button>
                                <button type="button" onClick={handleClear} className={styles.clearButton}>Clear</button>
                            </div>
                            {message && (
                                <p className={success ? styles.successMessage : styles.errorMessage}>
                                    {message}
                                </p>
                            )}
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AccountManagement;
