import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../css/livemap.module.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import { DefaultIcon, initializeMap, useLiveMapLogic } from '../components/LiveMap';
import L from 'leaflet';
import SingaporeTrafficHotspots from './trafficHotspot';
import Navbar from './navbar';
import RoutingService from './routingService';
import { FaMapMarkerAlt, FaRoute, FaCar, FaTrash, FaSync, FaChartLine } from 'react-icons/fa';
import VehicleMarker from './VehicleMarker';

L.Marker.prototype.options.icon = DefaultIcon;

const LiveMap = () => {
    const navigate = useNavigate();
    const [showHotspots, setShowHotspots] = useState(false);
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
        clearAllSelections,
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
            <button 
                className={styles.modernBackButton}
                onClick={() => navigate('/traffic-management')}
            >
                <span className={styles.backArrow}>←</span>
                <span className={styles.backText}>Back to Traffic Management</span>
            </button>
            <h1 className={styles.title}>FlowX</h1>
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

                            <button
                                className={`${styles.controlButton} ${showHotspots ? styles.active : ''}`}
                                onClick={() => setShowHotspots(!showHotspots)}
                            >
                                <FaChartLine />
                                <span>Traffic Hotspots</span>
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
                    </div>
                </div>

                <div className={styles.centerContent}>
                    <div className={styles.mapSection}>
                        <div className={styles.mapContainer}>
                            <div
                                ref={mapRef}
                                className={`${styles.map} ${isNodePlacementEnabled ? styles.placementMode : ''}`}
                            />
                            {showTrafficFlow && mapInstanceRef.current && routeConnections.map(connection => {
                                const route = routingServiceRef.current?.getRouteDetails(connection.routeId);
                                const traffic = trafficData[connection.routeId];
                                if (!route?.coordinates) return null;
                                
                                return (
                                    <VehicleMarker
                                        key={connection.routeId}
                                        map={mapInstanceRef.current}
                                        coordinates={route.coordinates}
                                        currentSpeed={traffic?.flow?.currentSpeed || 0}
                                        color={trafficServiceRef.current.getTrafficColor(traffic?.congestion || 0)}
                                    />
                                );
                            })}
                        </div>
                    </div>

                    {routeConnections.length > 0 && (
                        <div className={styles.routesPanel}>
                            <div className={styles.routesPanelHeader}>
                                <h3>Active Routes</h3>
                                <span className={styles.routeCount}>
                                    {routeConnections.length} {routeConnections.length === 1 ? 'route' : 'routes'}
                                </span>
                            </div>
                            <div className={styles.routesGrid}>
                                {routeConnections.map((connection) => {
                                    const traffic = trafficData[connection.routeId] || {};
                                    const route = routingServiceRef.current?.getRouteDetails(connection.routeId);
                                    console.log('Route traffic data:', traffic); // Debug log
                                    
                                    // Extract values with fallbacks
                                    const currentSpeed = traffic?.flow?.currentSpeed || 0;
                                    const congestion = traffic?.congestion || 0;
                                    const distance = (route?.distance || 0) / 1000;
                                    const duration = Math.ceil((route?.time || 0) / 60);
                                    
                                    return (
                                        <div key={connection.routeId} className={styles.routeCard}>
                                            <div className={styles.routeMainInfo}>
                                                <div className={styles.routePath}>
                                                    <span>{nodeRoadNames[connection.node1]}</span>
                                                    <FaRoute className={styles.routeIcon} />
                                                    <span>{nodeRoadNames[connection.node2]}</span>
                                                </div>
                                                <div className={styles.routeStats}>
                                                    <div className={styles.stat}>
                                                        <span>{distance.toFixed(1)} km</span>
                                                    </div>
                                                    <div className={styles.stat}>
                                                        <span>{duration} min</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {showTrafficFlow && (
                                                <div className={styles.trafficStatus} 
                                                     data-level={congestion < 30 ? 'low' : congestion < 60 ? 'medium' : 'high'}>
                                                    <span className={styles.speed}>
                                                        {Math.round(currentSpeed)} km/h
                                                    </span>
                                                    <span className={styles.congestion}>
                                                        {Math.round(congestion)}% congested
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.rightPanel}>
                    {showHotspots && (
                        <SingaporeTrafficHotspots 
                            trafficService={trafficServiceRef.current}
                            mapInstance={mapInstanceRef.current}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveMap;