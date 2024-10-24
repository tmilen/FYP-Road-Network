import React, { useEffect, useState } from 'react';
import Navbar from './navbar';
import '../css/mainmenu.css'; // Assuming your CSS file is already set up
import image from '../img/traffic.gif'; // Replace with the actual image you want to use

const MainMenu = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = () => {
    const servicesSection = document.getElementById('services');
    if (servicesSection) {
      const sectionTop = servicesSection.getBoundingClientRect().top;
      const windowHeight = window.innerHeight;

      // Trigger fade-in when the section is within the viewport
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
    <div className="main-menu">
      <div className="background-gif"></div>
      <div id="home" className="top-section"></div>
      <h1 className="main-menu-title">FlowX</h1>
      <Navbar sticky={true} />

      {/* Home Section */}
      <div id="home" className="home-section">
        {/* This section can be empty or you can add content later */}
      </div>

      <div className="content">
        {/* About Us Section */}
        <div id="about-us" className="about-us-section">
          <div className="about-text">
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
          <div className="about-image">
            <img src={image} alt="Traffic management illustration" />
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div id="services" className={`services-section fade-in ${isVisible ? 'visible' : ''}`}>
        <h2>⎯⎯ Our Services</h2>
        <div className="services-content">
          <div className="service">
            <h3>Traffic Analysis</h3>
            <p>
              In-depth analysis of traffic patterns to identify congestion hotspots and propose effective solutions.
            </p>
          </div>
          <div className="service">
            <h3>Real-time Monitoring</h3>
            <p>
              Continuous monitoring of traffic flow to provide real-time updates and alerts to authorities.
            </p>
          </div>
          <div className="service">
            <h3>Data Reporting</h3>
            <p>
              Comprehensive reporting tools for traffic data to assist in strategic decision-making.
            </p>
          </div>
        </div>
      </div>

      {/* Contact Us Section */}
      <div id="contact-us" className="contact-us-section">
        <h2>⎯⎯ Contact Us</h2>
        <p>If you have any questions or inquiries, please reach out to us!</p>
        <form className="contact-form">
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
