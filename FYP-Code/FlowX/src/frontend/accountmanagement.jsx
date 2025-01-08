import React from 'react';
import Navbar from './navbar';
import { IoIosCloseCircleOutline } from "react-icons/io";  // Updated import
import { FaUser, FaEnvelope, FaCalendar, FaUserTag } from 'react-icons/fa';
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
        setPasswords,
        setMessage,
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
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />

            <div className={styles.accountManagementContainer}>
                <div className={styles.accountBox}>
                    <div className={styles.profileHeader}>
                        <div className={styles.avatarCircle}>
                            {userData.first_name?.[0]}{userData.last_name?.[0]}
                        </div>
                        <h2>{userData.first_name} {userData.last_name}</h2>
                        <span className={styles.roleTag}>{formatRole(userData.role)}</span>
                    </div>
                    
                    <div className={styles.infoGrid}>
                        <div className={styles.infoItem}>
                            <FaUser className={styles.infoIcon} />
                            <div>
                                <label>Username</label>
                                <p>{userData.username}</p>
                            </div>
                        </div>
                        <div className={styles.infoItem}>
                            <FaEnvelope className={styles.infoIcon} />
                            <div>
                                <label>Email</label>
                                <p>{userData.email}</p>
                            </div>
                        </div>
                        <div className={styles.infoItem}>
                            <FaCalendar className={styles.infoIcon} />
                            <div>
                                <label>Date of Birth</label>
                                <p>{userData.date_of_birth}</p>
                            </div>
                        </div>
                        <div className={styles.infoItem}>
                            <FaUserTag className={styles.infoIcon} />
                            <div>
                                <label>Role</label>
                                <p>{formatRole(userData.role)}</p>
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={() => setShowPasswordForm(!showPasswordForm)} 
                        className={styles.changePasswordButton}
                    >
                        Change Password
                    </button>
                </div>

                {showPasswordForm && (
                    <div className={styles.passwordFormContainer}>
                        <div className={styles.passwordFormHeader}>
                            <h3>Change Password</h3>
                            <button onClick={() => setShowPasswordForm(false)} className={styles.closePasswordForm}>
                                <IoIosCloseCircleOutline />  {/* Updated icon component */}
                            </button>
                        </div>
                        <form onSubmit={handlePasswordSubmit} className={styles.passwordForm}>
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
                                <button type="submit" className={styles.changePasswordSubmit}>
                                    Update Password
                                </button>
                                <button type="button" onClick={handleClear} className={styles.clearButton}>
                                    Clear
                                </button>
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
