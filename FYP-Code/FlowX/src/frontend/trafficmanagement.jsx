import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './navbar';
import styles from '../css/trafficmanagement.module.css';
import { FaMap, FaChartLine, FaFileAlt } from 'react-icons/fa';
import { MdLocationOn } from 'react-icons/md';

function TrafficManagement() {
    const navigate = useNavigate();

    const features = [
        {
            title: 'Live Map',
            description: 'Real-time traffic monitoring and visualization',
            icon: <MdLocationOn className={styles.featureIcon} />,
            path: '/live-map',
            color: '#4CAF50'
        },
        {
            title: 'Upload Town Map',
            description: 'Import and manage town blueprints',
            icon: <FaMap className={styles.featureIcon} />,
            path: '/upload-map',
            color: '#2196F3'
        },
        {
            title: 'Traffic Data',
            description: 'Analyze historical and current traffic patterns',
            icon: <FaChartLine className={styles.featureIcon} />,
            path: '/traffic-data',
            color: '#9C27B0'
        },
        {
            title: 'Reports',
            description: 'Generate and view traffic analysis reports',
            icon: <FaFileAlt className={styles.featureIcon} />,
            path: '/reports',
            color: '#FF9800'
        }
    ];

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />
            <div className={styles.navbarGap}></div>
            
            <div className={styles.contentContainer}>
                <h2 className={styles.subtitle}>Select a Feature</h2>
                <div className={styles.featuresGrid}>
                    {features.map((feature, index) => (
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
