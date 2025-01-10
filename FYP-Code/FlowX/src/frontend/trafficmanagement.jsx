import React from 'react';
import Navbar from './navbar';
import styles from '../css/trafficmanagement.module.css';
import useTrafficManagement from '../components/trafficmanagement';

function TrafficManagement() {
    const { availableFeatures, navigate } = useTrafficManagement();

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />
            <div className={styles.navbarGap}></div>
            
            <div className={styles.contentContainer}>
                <h2 className={styles.subtitle}>Select a Feature</h2>
                <div className={styles.featuresGrid}>
                    {availableFeatures.map((feature, index) => (
                        <div 
                            key={index}
                            className={styles.featureCard}
                            onClick={() => navigate(feature.path)}
                            style={{'--hover-color': feature.color}}
                        >
                            <div className={styles.iconContainer} style={{backgroundColor: feature.color}}>
                                {feature.icon}
                            </div>
                            <h3 className={styles.featureTitle}>{feature.title}</h3>
                            <p className={styles.featureDescription}>{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default TrafficManagement;
