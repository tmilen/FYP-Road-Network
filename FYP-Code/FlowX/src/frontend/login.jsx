import React from 'react';
import { CiLock, CiUser } from "react-icons/ci";
import Navbar from './navbar';
import styles from '../css/login.module.css';
import image from '../img/register-image-1.jpg';
import useLoginController from '../components/login'; 

const Login = () => {
  const {
    username,
    password,
    errorMessage,
    handleUsernameChange,
    handlePasswordChange,
    handleSubmit
  } = useLoginController(); 

  return (
    <>
      <h1 className={styles.loginTitle}>FlowX</h1>
      <Navbar sticky={false} />
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2>Login</h2>
          {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
          <form onSubmit={handleSubmit}>
            <div className={`${styles.inputGroup} ${styles.iconInputGroup}`}>
              <label>Username</label>
              <div className={styles.inputWrapper}>
                <CiUser className={styles.inputIcon} />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={handleUsernameChange}
                />
              </div>
            </div>
            <div className={`${styles.inputGroup} ${styles.iconInputGroup}`}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <CiLock className={styles.inputIcon} />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={handlePasswordChange}
                />
              </div>
            </div>
            <button type="submit" className={styles.signInButton}>Login</button>
          </form>
          <p><a href="#">Forget password?</a></p>
        </div>
        <div className={styles.imageBox}>
          <img src={image} alt="Sign in" />
        </div>
      </div>
    </>
  );
};

export default Login;
