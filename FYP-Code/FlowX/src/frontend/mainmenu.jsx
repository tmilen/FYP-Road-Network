import React, { useEffect, useState } from 'react';
import Navbar from './navbar';
import styles from '../css/mainmenu.module.css'; 
import image from '../img/traffic.gif'; 

const MainMenu = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = () => {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      const sectionTop = servicesSection.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;

      if (sectionTop <= windowHeight * 0.8) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={styles.mainMenu}>
      <div className={styles.backgroundGif}></div>
      <h1 className={styles.mainMenuTitle}>FlowX</h1>
      <Navbar sticky={true} />

      <div id="home" className={styles.homeSection}>
      </div>

      <div className={styles.content}>
        <div id="about-us" className={styles.aboutUsSection}>
          <div className={styles.aboutText}>
            <h2>⎯⎯ About Us</h2>
            <p>
              The vision of this project is to create a data-driven solution for dynamic traffic management, enabling transport authorities to proactively address congestion and improve the overall flow of traffic.
            </p>
            <p>
              By offering a detailed understanding of traffic bottlenecks and their ripple effects on the surrounding network, the system aims to enhance the efficiency of urban transportation, reduce travel times, and improve the quality of life for commuters.
            </p>
            <p>
              The ultimate goal is to empower cities to develop smarter, more sustainable traffic management strategies that are adaptive to real-time conditions.
            </p>
          </div>
          <div className={styles.aboutImage}>
            <img src={image} alt="Traffic management illustration" />
          </div>
        </div>
      </div>

      <div id="services" className={`${styles.servicesSection} ${styles.fadeIn} ${isVisible ? styles.visible : ''}`}>
        <h2>⎯⎯ Our Services</h2>
        <div className={styles.servicesContent}>
          <div className={styles.service}>
            <h3>Traffic Analysis</h3>
            <p>
              In-depth analysis of traffic patterns to identify congestion hotspots and propose effective solutions.
            </p>
          </div>
          <div className={styles.service}>
            <h3>Real-time Monitoring</h3>
            <p>
              Continuous monitoring of traffic flow to provide real-time updates and alerts to authorities.
            </p>
          </div>
          <div className={styles.service}>
            <h3>Data Reporting</h3>
            <p>
              Comprehensive reporting tools for traffic data to assist in strategic decision-making.
            </p>
          </div>
        </div>
      </div>

      <div id="contact-us" className={styles.contactUsSection}>
        <h2>⎯⎯ Contact Us</h2>
        <p>If you have any questions or inquiries, please reach out to us!</p>
        <form className={styles.contactForm}>
          <label htmlFor="name">Name:</label>
          <input type="text" id="name" name="name" required />
          
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" name="email" required />
          
          <label htmlFor="message">Message:</label>
          <textarea id="message" name="message" required></textarea>
          
          <button type="submit">Send Message</button>
        </form>
      </div>
    </div>
  );
};

export default MainMenu;
