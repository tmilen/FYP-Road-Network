import React, { useState, useEffect, useCallback } from 'react';
import styles from '../css/livemap.module.css';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const SingaporeTrafficHotspots = ({ trafficService, mapInstance }) => {
    const [hotspots, setHotspots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [displayCount, setDisplayCount] = useState(10);
    
    const handleHotspotClick = useCallback((hotspot) => {
        if (mapInstance && mapInstance.getContainer() && !mapInstance._isDestroyed) {
            try {
                mapInstance.setView([hotspot.coordinates.lat, hotspot.coordinates.lng], 16, {
                    animate: true,
                    duration: 1
                });
            } catch (error) {
                console.error('Error panning to location:', error);
            }
        }
    }, [mapInstance]);

    const fetchTrafficHotspots = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_URL}/traffic/data`);
            const allTrafficData = response.data;

            // Sort roads by congestion level
            const sortedHotspots = allTrafficData
                .map(road => {
                    const speedRatio = road.currentSpeed / road.freeFlowSpeed;
                    const congestion = Math.round((1 - speedRatio) * 100);
                    return {
                        ...road,
                        congestion
                    };
                })
                .sort((a, b) => b.congestion - a.congestion) // Sort by congestion level descending
                .slice(0, displayCount); // Take only the top N congested roads

            setHotspots(sortedHotspots);
        } catch (error) {
            console.error('Error fetching traffic hotspots:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchTrafficHotspots();
        const interval = setInterval(fetchTrafficHotspots, 300000); // Update every 5 minutes
        return () => clearInterval(interval);
    }, [displayCount]); // Re-fetch when displayCount changes

    const getStatusColor = (congestion) => {
        if (congestion < 30) return '#4CAF50';
        if (congestion < 60) return '#FFA000';
        return '#F44336';
    };

    if (loading) {
        return (
            <div className={styles.congestionTracker}>
                <h3>Singapore Traffic Hotspots</h3>
                <div className={styles.loading}>Loading traffic data...</div>
            </div>
        );
    }

    return (
        <div className={styles.congestionTracker}>
            <div className={styles.hotspotHeader}>
                <h3>Traffic Hotspots</h3>
                <select 
                    value={displayCount}
                    onChange={(e) => setDisplayCount(Number(e.target.value))}
                    className={styles.hotspotSelect}
                >
                    <option value={5}>Top 5</option>
                    <option value={10}>Top 10</option>
                    <option value={15}>Top 15</option>
                    <option value={20}>Top 20</option>
                </select>
            </div>
            <div className={styles.congestionList}>
                {hotspots.map((hotspot, index) => (
                    <div 
                        key={index}
                        className={`${styles.congestionItem} ${styles.clickable}`}
                        style={{
                            borderLeft: `4px solid ${getStatusColor(hotspot.congestion)}`,
                            cursor: mapInstance ? 'pointer' : 'default'
                        }}
                        onClick={() => mapInstance && handleHotspotClick(hotspot)}
                    >
                        <div className={styles.congestionHeader}>
                            <span className={styles.congestionRoute}>
                                {hotspot.streetName}
                            </span>
                            <span 
                                className={styles.congestionValue}
                                style={{ color: getStatusColor(hotspot.congestion) }}
                            >
                                {Math.round(hotspot.congestion)}%
                            </span>
                        </div>
                        <div className={styles.congestionDetails}>
                            <div>Speed: {Math.round(hotspot.currentSpeed)} km/h</div>
                            <div>Free Flow: {Math.round(hotspot.freeFlowSpeed)} km/h</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default React.memo(SingaporeTrafficHotspots);
