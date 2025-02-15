import React, { useEffect, useState } from 'react';
import Navbar from './navbar';
import styles from '../css/mainmenu.module.css'; 
import image from '../img/Intersection.jpg';
import johnDoePhoto from '../img/speed.jpg';
import obamaPhoto from '../img/obama.jpg';  // Changed from dominicPhoto
import benPhoto from '../img/885.jpg';      // Added benPhoto import
import suPhoto from '../img/su.jpg';  // Add this import
import theoPhoto from '../img/theo.jpg';  // Add this import

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
      <div className={styles.logoText}>
        <div>The Next</div>
        <div>Generation</div>
        <div>Traffic</div>
        <div>App</div>
      </div>
      <div className={styles.promotionalText}>
        Revolutionizing urban mobility with AI-powered traffic solutions
      </div>
      <div className={styles.promotionalText}>
        <div>Unlimited Analysis, Unlimited Solutions.</div>
        <div>Available 24/7, Everywhere.</div>
        <div>Trusted by Transport Authorities Worldwide.</div>
      </div>
      
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

      <div id="team" className={styles.teamSection}>
        <h2>⎯⎯ Our Team</h2>
        <div className={styles.teamGrid}>
          <div className={styles.teamMember}>
            <div className={styles.memberPhoto}>
              <img src={johnDoePhoto} alt="John Doe" className={styles.memberImage} />
            </div>
            <h3>Tsun Hong</h3>
            <p>Lead Developer</p>
          </div>
          <div className={styles.teamMember}>
            <div className={styles.memberPhoto}>
              <img src={suPhoto} alt="SU" className={styles.memberImage} />
            </div>
            <h3>SU</h3>
            <p>Traffic Analyst</p>
          </div>
          <div className={styles.teamMember}>
            <div className={styles.memberPhoto}>
              <img src={obamaPhoto} alt="Dominic" className={styles.memberImage} />
            </div>
            <h3>Dominic</h3>
            <p>Data Scientist</p>
          </div>
          <div className={styles.teamMember}>
            <div className={styles.memberPhoto}>
              <img src={theoPhoto} alt="Theophilus" className={styles.memberImage} />
            </div>
            <h3>Theophilus</h3>
            <p>UX Designer</p>
          </div>
          <div className={styles.teamMember}>
            <div className={styles.memberPhoto}>
              <img src={benPhoto} alt="Ben" className={styles.memberImage} />
            </div>
            <h3>Ben</h3>
            <p>System Architect</p>
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

      <div id="pricing" className={styles.pricingSection}>
        <h2>⎯⎯ Pricing</h2>
        <div className={styles.pricingContent}>
          <div className={styles.pricingCard}>
            <h3>Basic</h3>
            <div className={styles.price}>$14.99/month</div>
            <ul>
              <li>Basic Traffic Analysis</li>
              <li>Standard Reports</li>
              <li>Email Support</li>
            </ul>
            <button>Get Started</button>
          </div>
          <div className={styles.pricingCard}>
            <h3>Professional</h3>
            <div className={styles.price}>S$29.99/month</div>
            <ul>
              <li>Advanced Traffic Analysis</li>
              <li>Real-time Monitoring</li>
              <li>Priority Support</li>
              <li>Custom Reports</li>
            </ul>
            <button>Get Started</button>
          </div>
          <div className={styles.pricingCard}>
            <h3>Enterprise</h3>
            <div className={styles.price}>Contact Us</div>
            <ul>
              <li>Full Feature Access</li>
              <li>24/7 Support</li>
              <li>Custom Solutions</li>
              <li>Dedicated Account Manager</li>
            </ul>
            <button>Contact Sales</button>
          </div>
        </div>
        <div className={styles.planComparison}>
          <h3>Plan Comparison</h3>
          <div className={styles.comparisonTable}>
            <table>
              <thead>
                <tr>
                  <th>Features</th>
                  <th>Basic</th>
                  <th>Professional</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Traffic Analysis</td>
                  <td>Basic</td>
                  <td>Advanced</td>
                  <td>Full Access</td>
                </tr>
                <tr>
                  <td>Data Updates</td>
                  <td>Daily</td>
                  <td>Hourly</td>
                  <td>Real-time</td>
                </tr>
                <tr>
                  <td>Report Generation</td>
                  <td>Monthly</td>
                  <td>Weekly</td>
                  <td>Custom</td>
                </tr>
                <tr>
                  <td>API Access</td>
                  <td>❌</td>
                  <td>✅</td>
                  <td>✅</td>
                </tr>
                <tr>
                  <td>Support Response</td>
                  <td>48 hours</td>
                  <td>24 hours</td>
                  <td>1 hour</td>
                </tr>
                <tr>
                  <td>Custom Integration</td>
                  <td>❌</td>
                  <td>❌</td>
                  <td>✅</td>
                </tr>
              </tbody>
            </table>
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
      
      <div className={styles.divider}></div>
      <div className={styles.contactInfo}>
        <div className={styles.emailContact}>
          <p><a href="mailto:flow.x@gmail.com">flow.x@gmail.com</a></p>
        </div>
        <div className={styles.addressContact}>
          <p>123 Tekong, Singapore 999</p>
        </div>
      </div>
      <div className={styles.copyright}>
        <p>2025 FlowX. All Rights Reserved.</p>
      </div>
    </div>
  );
};

export default MainMenu;
