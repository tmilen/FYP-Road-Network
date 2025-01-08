import React, { useEffect } from 'react';
import styles from '../css/livemap.module.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { DefaultIcon, initializeMap, useLiveMapLogic } from '../components/LiveMap';
import L from 'leaflet';
import SingaporeTrafficHotspots from './trafficHotspot';
import Navbar from './navbar';
import RoutingService from './routingService';
import { FaMapMarkerAlt, FaRoute, FaCar, FaTrash, FaSync } from 'react-icons/fa';

L.Marker.prototype.options.icon = DefaultIcon;

const LiveMap = () => {
    const {
        error,
        isNodePlacementEnabled,
        setIsNodePlacementEnabled,
        selectedNodes,
        nodeRoadNames,
        routeConnections,
        showTrafficFlow,
        setShowTrafficFlow,
        trafficData,
        mapRef,
        mapInstanceRef,
        markersRef,
        clickListenerRef,
        routingServiceRef,
        trafficServiceRef,
        updateTrafficFlow,
        handleMapClick,
        clearAllSelections
    } = useLiveMapLogic();

    useEffect(() => {
        if (!mapInstanceRef.current && mapRef.current) {
            mapInstanceRef.current = initializeMap(mapRef.current);
            routingServiceRef.current = new RoutingService();
            routingServiceRef.current.initRouting(mapInstanceRef.current);
        }
        return () => {
            if (mapInstanceRef.current) {
                routingServiceRef.current?.clearAllRoutes();
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        let interval;
        if (showTrafficFlow) {
            updateTrafficFlow();
            interval = setInterval(updateTrafficFlow, 60000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [showTrafficFlow, routeConnections, updateTrafficFlow]);

    useEffect(() => {
        if (mapInstanceRef.current) {
            if (clickListenerRef.current) {
                mapInstanceRef.current.off('click', clickListenerRef.current);
            }
            if (isNodePlacementEnabled) {
                clickListenerRef.current = handleMapClick;
                mapInstanceRef.current.on('click', clickListenerRef.current);
            }
        }
        return () => {
            if (mapInstanceRef.current && clickListenerRef.current) {
                mapInstanceRef.current.off('click', clickListenerRef.current);
            }
        };
    }, [isNodePlacementEnabled, handleMapClick]);

    if (error) {
        return (
            <div className={styles.errorContainer}>
                <p className={styles.errorMessage}>{error}</p>
            </div>
        );
    }

    return (
        <div className={styles.appContainer}>
            <Navbar sticky={false} />
            
            <div className={styles.mainContent}>
                <div className={styles.leftPanel}>
                    <div className={styles.controlPanel}>
                        <h2 className={styles.panelTitle}>Traffic Analysis Tools</h2>
                        <div className={styles.controlButtons}>
                            <button
                                className={`${styles.controlButton} ${isNodePlacementEnabled ? styles.active : ''}`}
                                onClick={() => setIsNodePlacementEnabled((prev) => !prev)}
                            >
                                <FaMapMarkerAlt />
                                <span>Place Nodes</span>
                            </button>
                            
                            <button
                                className={`${styles.controlButton} ${showTrafficFlow ? styles.active : ''}`}
                                onClick={() => setShowTrafficFlow(!showTrafficFlow)}
                            >
                                <FaCar />
                                <span>Traffic Flow</span>
                            </button>

                            <button
                                className={styles.controlButton}
                                onClick={() => updateTrafficFlow()}
                            >
                                <FaSync />
                                <span>Refresh Data</span>
                            </button>

                            {selectedNodes.length > 0 && (
                                <button 
                                    className={`${styles.controlButton} ${styles.warning}`} 
                                    onClick={clearAllSelections}
                                >
                                    <FaTrash />
                                    <span>Clear All</span>
                                </button>
                            )}
                        </div>

                        {routeConnections.length > 0 && (
                            <div className={styles.routeList}>
                                <h3>Active Routes</h3>
                                <div className={styles.routeItems}>
                                    {routeConnections.map((connection) => {
                                        const traffic = trafficData[connection.routeId] || {};
                                        const congestion = parseInt(traffic?.congestion) || 0;
                                        return (
                                            <div key={connection.routeId} className={styles.routeItem}>
                                                <div className={styles.routeInfo}>
                                                    <FaRoute className={styles.routeIcon} />
                                                    <div className={styles.routeDetails}>
                                                        <div className={styles.routeEndpoints}>
                                                            <span>{nodeRoadNames[connection.node1]}</span>
                                                            <span>→</span>
                                                            <span>{nodeRoadNames[connection.node2]}</span>
                                                        </div>
                                                        {showTrafficFlow && (
                                                            <div className={styles.trafficInfo}>
                                                                <span 
                                                                    className={styles.congestionBadge}
                                                                    data-level={congestion < 30 ? 'low' : congestion < 60 ? 'medium' : 'high'}
                                                                >
                                                                    {congestion}% Congested
                                                                </span>
                                                                <span className={styles.speedInfo}>
                                                                    {Math.round(traffic?.flow?.currentSpeed || 0)} km/h
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.mapSection}>
                    <div className={styles.mapContainer}>
                        <div
                            ref={mapRef}
                            className={`${styles.map} ${isNodePlacementEnabled ? styles.placementMode : ''}`}
                        />
                    </div>
                </div>

                <div className={styles.rightPanel}>
                    <SingaporeTrafficHotspots 
                        trafficService={trafficServiceRef.current}
                        mapInstance={mapInstanceRef.current}
                    />
                </div>
            </div>
        </div>
    );
};

export default LiveMap;