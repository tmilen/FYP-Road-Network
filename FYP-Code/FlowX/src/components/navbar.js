import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { handleLogout } from './logout';

const useNavbarController = (sticky) => {
  const [isSticky, setSticky] = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState({}); // State for permissions
  const dropdownRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL; // Load API URL from .env
  const navigate = useNavigate();

  const handleScroll = () => {
    if (sticky) {
      if (window.scrollY > 50) {
        setSticky(true);
      } else {
        setSticky(false);
      }
    }
  };

  useEffect(() => {
    if (sticky) {
      window.addEventListener('scroll', handleScroll);
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [sticky]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  useEffect(() => {
    axios
      .get(`${API_URL}/session`, { withCredentials: true })
      .then((response) => {
        if (response.data.username) {
          setUsername(response.data.username);
          setRole(response.data.role);
          setPermissions(response.data.permissions || {}); // Fetch and set permissions
        }
      })
      .catch((error) => {
        console.error("Error fetching session data", error);
      });
  }, [API_URL]);

  const toggleDropdown = () => {
    setDropdownOpen(!isDropdownOpen);
  };

  return {
    isSticky,
    isDropdownOpen,
    toggleDropdown,
    dropdownRef,
    username,
    role,
    permissions, 
    handleLogout: () => handleLogout({ setUsername, setRole, setPermissions, navigate, API_URL }),
  };
};

export default useNavbarController;
