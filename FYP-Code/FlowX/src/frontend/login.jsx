import React, { useState } from 'react';
import { CiLock, CiUser } from "react-icons/ci";
import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";
import Navbar from './navbar';
import styles from '../css/login.module.css';
import image from '../img/register-image-1.jpg';
import useLoginController from '../components/login'; 

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const {
    username,
    password,
    errorMessage,
    handleUsernameChange,
    handlePasswordChange,
    handleSubmit
  } = useLoginController(); 

  return (
    <div className={styles.pageContainer}>
      <h1 className={styles.loginTitle}>FlowX</h1>
      <Navbar sticky={false} />
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h2>Welcome Back</h2>
          {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
          <form onSubmit={handleSubmit}>
            <div className={styles.inputGroup}>
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
            <div className={styles.inputGroup}>
              <label>Password</label>
              <div className={styles.inputWrapper}>
                <CiLock className={styles.inputIcon} />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={handlePasswordChange}
                />
                <button
                  type="button"
                  className={styles.peekButton}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <AiOutlineEyeInvisible /> : <AiOutlineEye />}
                </button>
              </div>
            </div>
            <button type="submit" className={styles.signInButton}>
              Sign In
            </button>
          </form>
          <p style={{ textAlign: 'center', marginTop: '1rem' }}>
            <a href="#">Forgot your password?</a>
          </p>
        </div>
        <div className={styles.imageBox}>
          <img src={image} alt="Login" />
        </div>
      </div>
    </div>
  );
};

export default Login;
