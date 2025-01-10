import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styles from '../css/navbar.module.css';
import useNavbarController from '../components/navbar';
import { FaUser } from 'react-icons/fa';

const Navbar = ({ sticky }) => {
  const {
    isSticky,
    isDropdownOpen,
    toggleDropdown,
    dropdownRef,
    username,
    permissions,
    handleLogout,
  } = useNavbarController(sticky);

  const navigate = useNavigate();

  const smoothScroll = (event, targetId) => {
    event.preventDefault();

    const targetElement = document.getElementById(targetId);
    const currentPath = window.location.pathname;

    if (currentPath !== '/') {
      navigate('/');
      setTimeout(() => {
        scrollToSection(targetId);
      }, 500);
    } else {
      scrollToSection(targetId);
    }
  };

  const scrollToSection = (targetId) => {
    const targetElement = document.getElementById(targetId);
    if (targetElement) {
      const navbarHeight = document.querySelector(`.${styles.navbar}`).offsetHeight || 0;
      const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
      const offsetPosition = elementPosition - navbarHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  const dropdownItems = [
    // Only include menu items if user has corresponding permission
    permissions?.manage_users && {
      key: 'manage_users',
      label: 'User Management',
      path: '/manage-users',
    },
    permissions?.data_health && {
      key: 'data_health',
      label: 'Data Health',
      path: '/data-health',
    },
    permissions?.traffic_management && {
      key: 'traffic_management',
      label: 'Traffic Management',
      path: '/traffic-management',
    },
  ].filter(Boolean); // Filter out falsy values (undefined from permissions checks)

  const staticItems = [
    {
      key: 'manage_account',
      label: 'Manage Account',
      path: '/account-management', 
    },
  ];

  return (
    <nav className={`${styles.navbar} ${isSticky ? styles.sticky : ''}`}>
      <ul className={styles.navbarList}>
        <li className={styles.navbarItem}>
          <Link
            to="/"
            className={styles.navLink}
            onClick={(e) => smoothScroll(e, 'home')}
          >
            Home
          </Link>
        </li>
        <li className={styles.navbarItem}>
          <Link
            to="/#about-us"
            className={styles.navLink}
            onClick={(e) => smoothScroll(e, 'about-us')}
          >
            About Us
          </Link>
        </li>
        <li className={styles.navbarItem}>
          <Link
            to="/#services"
            className={styles.navLink}
            onClick={(e) => smoothScroll(e, 'services')}
          >
            Services
          </Link>
        </li>
        <li className={styles.navbarItem}>
          <Link
            to="/#contact-us"
            className={styles.navLink}
            onClick={(e) => smoothScroll(e, 'contact-us')}
          >
            Contact Us
          </Link>
        </li>

        {/* Dynamic dropdown based on permissions */}
        {username ? (
          <li className={styles.navbarItem} ref={dropdownRef}>
            <button className={styles.dropdownButton} onClick={toggleDropdown}>
              <FaUser />
              <span className={styles.welcomeMessage}>{username}</span>
            </button>
            {isDropdownOpen && (
              <div className={styles.dropdownMenu}>
                {/* Show static items first */}
                {staticItems.map((item) => (
                  <Link key={item.key} to={item.path} className={styles.dropdownLink}>
                    {item.label}
                  </Link>
                ))}
                {/* Then show permission-based items */}
                {dropdownItems.map((item) => (
                  <Link key={item.key} to={item.path} className={styles.dropdownLink}>
                    {item.label}
                  </Link>
                ))}
                <button
                  className={styles.logout}
                  onClick={() => handleLogout()}
                >
                  Logout
                </button>
              </div>
            )}
          </li>
        ) : (
          <li className={`${styles.navbarItem} ${styles.login}`}>
            <a href="/login" className={styles.navLink}>
              Login
            </a>
          </li>
        )}
      </ul>
    </nav>
  );
};

export default Navbar;