import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const useNavbarController = () => {
  const [isSticky, setSticky] = useState(false);
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [username, setUsername] = useState(null);
  const [role, setRole] = useState(null);

  const handleScroll = () => {
    if (window.scrollY > 50) {
      setSticky(true);
    } else {
      setSticky(false);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
    axios.get('http://localhost:5000/session', { withCredentials: true })
      .then(response => {
        if (response.data.username) {
          setUsername(response.data.username);
          setRole(response.data.role);
        }
      })
      .catch(error => {
        console.error("Error fetching session data", error);
      });
  }, []);

  const handleSignOut = () => {
    axios.get('http://localhost:5000/logout', { withCredentials: true })
      .then(response => {
        setUsername(null);
        setRole(null);
      })
      .catch(error => {
        console.error("Error logging out", error);
      });
  };

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
    handleSignOut
  };
};

export default useNavbarController;
