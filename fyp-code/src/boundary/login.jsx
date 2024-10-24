import React from 'react';
import { CiLock, CiUser } from "react-icons/ci";
import Navbar from './navbar';
import '../css/login.css';
import image from '../img/register-image-1.jpg';
import useLoginController from '../controller/loginController'; // Import the controller

const Login = () => {
  const {
    username,
    password,
    errorMessage,
    handleUsernameChange,
    handlePasswordChange,
    handleSubmit
  } = useLoginController(); // Get the logic from the controller

  return (
    <>
      <h1 className="login-title">FlowX</h1>
      <Navbar sticky={false} /> {/* No sticky for login page */}
      <div className="login-container">
        <div className="login-box">
          <h2>Sign In</h2>
          {errorMessage && <div className="error-message">{errorMessage}</div>}
          <form onSubmit={handleSubmit}>
            <div className="input-group icon-input-group">
              <label>Username</label>
              <div className="input-wrapper">
                <CiUser className="input-icon" />
                <input
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={handleUsernameChange}
                />
              </div>
            </div>
            <div className="input-group icon-input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <CiLock className="input-icon" />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={handlePasswordChange}
                />
              </div>
            </div>
            <button type="submit">Sign In</button>
          </form>
          <p><a href="#">Forget password?</a></p>
        </div>
        <div className="image-box">
          <img src={image} alt="Sign in" />
        </div>
      </div>
    </>
  );
};

export default Login;
