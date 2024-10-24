import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/navbar.css';
import { GiHamburgerMenu } from "react-icons/gi";
import useNavbarController from '../controller/navbarController'; // Import your controller

const Navbar = () => {
  const {
    isSticky,
    isDropdownOpen,
    toggleDropdown,
    dropdownRef,
    username,
    role,
    handleSignOut
  } = useNavbarController(); // Get the logic from the controller

  const navigate = useNavigate();

  // Smooth scroll to section
  const smoothScroll = (event, targetId) => {
    event.preventDefault(); 
    if (window.location.pathname !== '/') {
      navigate('/');
      setTimeout(() => {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };
  
  return (
    <nav className={`navbar ${isSticky ? 'sticky' : ''}`}>
      <ul className="navbar-list">
        <li className="navbar-item" onClick={(e) => smoothScroll(e, 'home')}><a href="#home">Home</a></li>
        <li className="navbar-item" onClick={(e) => smoothScroll(e, 'about-us')}><a href="#about-us">About Us</a></li>
        <li className="navbar-item" onClick={(e) => smoothScroll(e, 'services')}><a href="#services">Services</a></li>
        <li className="navbar-item" onClick={(e) => smoothScroll(e, 'contact-us')}><a href="#contact-us">Contact Us</a></li>
        {username ? (
          role === 'system_admin' ? (
            <>
              <li className="navbar-item" ref={dropdownRef}>
                <button className="dropdown-button" onClick={toggleDropdown}>
                  <GiHamburgerMenu size={24} />
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu">
                    <span className="welcome-message">Welcome, {username}</span>
                    <a href="/data-management">Data Management</a>
                    <a href="/user-management">Manage Users</a>
                    <a href="/account-management">Account Management</a>
                    <button className="sign-out" onClick={handleSignOut}>Sign Out</button>
                  </div>
                )}
              </li>
            </>
          ) : role === 'urban_planner' ? (
            <>
              <li className="navbar-item" ref={dropdownRef}>
                <button className="dropdown-button" onClick={toggleDropdown}>
                  <GiHamburgerMenu size={24} />
                </button>
                {isDropdownOpen && (
                  <div className="dropdown-menu">
                    <span className="welcome-message">Welcome, {username}</span>
                    <a href="/topk-roads">Top-K Critical Roads</a>
                    <a href="/real-time-traffic">Real Time Traffic</a>
                    <a href="/account-management">Account Management</a>
                    <button className="sign-out" onClick={handleSignOut}>Sign Out</button>
                  </div>
                )}
              </li>
            </>
          ) : (
            <li className="navbar-item">
              Welcome, {username} ({role})
              <button className="sign-out" onClick={handleSignOut}>Sign Out</button>
            </li>
          )
        ) : (
          <li className="navbar-item sign-in">
            <a href="/login">Sign In</a>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;
