import { useState, useCallback, useRef, useEffect } from 'react';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import TrafficService from '../frontend/trafficService';
import RoutingService from '../components/routingService';

const TOMTOM_API_KEY = process.env.TOMTOM_API_KEY

export const DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

// Selected marker icon
export const SelectedIcon = L.icon({
    ...DefaultIcon.options,
    iconUrl: icon,
    className: 'selected-marker'
});

export const initializeMap = (mapElement) => {
    const map = L.map(mapElement).setView([1.3521, 103.8198], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    return map;
};

export const fetchRoadName = async (lat, lng) => {
    try {
        // First try OpenStreetMap's Nominatim service
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?` +
            `format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`
        );
        const data = await response.json();
        
        if (data) {
            const roadName = data.address?.road || 
                           data.address?.highway ||
                           data.address?.expressway ||
                           data.name ||
                           data.display_name?.split(',')[0];

            if (roadName) return roadName;
        }

        // If OpenStreetMap fails, try TomTom as backup
        const tomtomResponse = await fetch(
            `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lng}.json?key=${TOMTOM_API_KEY}&radius=100`
        );
        const tomtomData = await tomtomResponse.json();
        
        if (tomtomData.addresses && tomtomData.addresses.length > 0) {
            const address = tomtomData.addresses[0];
            return address.streetName || 
                   address.street || 
                   address.roadName || 
                   'Unnamed Road';
        }

        return 'Unnamed Road';
    } catch (error) {
        console.error('Error fetching road name:', error);
        return 'Error fetching road name';
    }
};

export const checkRouteExists = (routeConnections, node1, node2, nodeRoadNames) => {
    return routeConnections.some(conn => 
        (conn.node1 === node1 && conn.node2 === node2) || 
        (conn.node1 === node2 && conn.node2 === node1) ||
        (nodeRoadNames[conn.node1] === nodeRoadNames[node1] && 
         nodeRoadNames[conn.node2] === nodeRoadNames[node2]) ||
        (nodeRoadNames[conn.node1] === nodeRoadNames[node2] && 
         nodeRoadNames[conn.node2] === nodeRoadNames[node1])
    );
};

export const useLiveMapLogic = () => {
    const [error, setError] = useState(null);
    const [isNodePlacementEnabled, setIsNodePlacementEnabled] = useState(false);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);
    const [nodeRoadNames, setNodeRoadNames] = useState({});
    const [routeConnections, setRouteConnections] = useState([]);
    const [nodeCounter, setNodeCounter] = useState(1);
    const [routeCounter, setRouteCounter] = useState(1);
    const [showTrafficFlow, setShowTrafficFlow] = useState(false);
    const [trafficData, setTrafficData] = useState({});

    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const linesRef = useRef({});
    const clickListenerRef = useRef(null);
    const routingServiceRef = useRef(null);
    const trafficServiceRef = useRef(new TrafficService());

    const updateTrafficFlow = async () => {
        if (!showTrafficFlow) return;
        const updatedTrafficData = {};
        
        for (const connection of routeConnections) {
            const startLatLng = markersRef.current[connection.node1].getLatLng();
            const endLatLng = markersRef.current[connection.node2].getLatLng();

            try {
                const data = await trafficServiceRef.current.getTrafficBetweenNodes(
                    startLatLng.lat,
                    startLatLng.lng,
                    endLatLng.lat,
                    endLatLng.lng
                );
                
                console.log('Traffic data received:', data);

                updatedTrafficData[connection.routeId] = data;

                // Update route style based on congestion
                const routeStyle = trafficServiceRef.current.getRouteStyle(data.congestion);
                routingServiceRef.current.updateRouteStyle(connection.routeId, routeStyle);
            } catch (error) {
                console.error('Error updating traffic data:', error);
                updatedTrafficData[connection.routeId] = {
                    flow: { currentSpeed: 0, freeFlowSpeed: 0 },
                    congestion: 0,
                    incidents: [],
                    accidentCount: 0,
                    congestionCount: 0
                };
            }
        }

        setTrafficData(updatedTrafficData);
    };

    const createRoute = useCallback(async (startNode, endNode) => {
        try {
            const startLatLng = markersRef.current[startNode].getLatLng();
            const endLatLng = markersRef.current[endNode].getLatLng();
            const routeId = `route_${routeCounter}`;
            
            // Calculate route first
            const { route } = await routingServiceRef.current.calculateRoute(startLatLng, endLatLng);
            
            // Calculate realistic duration based on distance and average speed
            const distanceInKm = route.summary.totalDistance / 1000; // Convert to kilometers
            const averageSpeedKmH = 40; // Average speed in Singapore (40 km/h)
            const durationInMinutes = Math.ceil((distanceInKm / averageSpeedKmH) * 60);
            
            // Store route details with corrected duration
            routingServiceRef.current.routes.set(routeId, {
                coordinates: route.coordinates,
                distance: route.summary.totalDistance,
                time: durationInMinutes * 60 // Store in seconds for consistency
            });

            if (showTrafficFlow) {
                try {
                    const trafficData = await trafficServiceRef.current.getTrafficBetweenNodes(
                        startLatLng.lat,
                        startLatLng.lng,
                        endLatLng.lat
                    );
                    
                    const currentSpeed = trafficData.flow?.currentSpeed || 0;
                    const freeFlowSpeed = trafficData.flow?.freeFlowSpeed || 0;
                    const congestion = trafficServiceRef.current.calculateCongestion(currentSpeed, freeFlowSpeed);
                    
                    const routeStyle = trafficServiceRef.current.getRouteStyle(congestion);
                    routingServiceRef.current.updateRouteStyle(routeId, routeStyle);
                    
                    setTrafficData(prev => ({
                        ...prev,
                        [routeId]: {
                            flow: {
                                currentSpeed: currentSpeed,
                                freeFlowSpeed: freeFlowSpeed
                            },
                            congestion: congestion
                        }
                    }));
                } catch (error) {
                    console.error('Error fetching traffic data:', error);
                }
            }

            setRouteCounter(prev => prev + 1);
            return routeId;
        } catch (error) {
            console.error('Error creating route:', error);
            return null;
        }
    }, [routeCounter, showTrafficFlow]);

    const createPopupContent = useCallback((nodeId, marker, selectNodeFn, removeNodeFn) => {
        const popupContent = document.createElement('div');
        popupContent.className = 'popup-content';

        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'popup-button-container';

        const selectButton = document.createElement('button');
        selectButton.innerHTML = `
            <svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>Select</span>
        `;
        selectButton.className = 'node-select-button';
        selectButton.onclick = (e) => {
            e.stopPropagation();
            marker.closePopup();
            selectNodeFn(nodeId);
        };

        const removeButton = document.createElement('button');
        removeButton.innerHTML = `
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path fill="none" d="M0 0h24v24H0z"></path>
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
            </svg>
            <span>Delete</span>
        `;
        removeButton.className = 'node-remove-button';
        removeButton.onclick = (e) => {
            e.stopPropagation();
            marker.closePopup();
            removeNodeFn(nodeId);
        };

        buttonContainer.appendChild(selectButton);
        buttonContainer.appendChild(removeButton);
        popupContent.appendChild(buttonContainer);

        return popupContent;
    }, []);

    const handleNodeRemove = useCallback((nodeId) => {
        console.log('Starting node removal for:', nodeId);
        
        try {
            // Remove marker from map first
            if (markersRef.current[nodeId]) {
                const marker = markersRef.current[nodeId];
                marker.unbindPopup();
                marker.remove();
                delete markersRef.current[nodeId];
            }

            // Remove associated routes
            setRouteConnections(prev => {
                const remainingConnections = prev.filter(
                    conn => !(conn.node1 === nodeId || conn.node2 === nodeId)
                );
                prev.forEach(conn => {
                    if (conn.node1 === nodeId || conn.node2 === nodeId) {
                        routingServiceRef.current?.removeRoute(conn.routeId);
                    }
                });
                return remainingConnections;
            });

            // Clean up all related state
            setNodes(prev => prev.filter(node => node.id !== nodeId));
            setNodeRoadNames(prev => {
                const updated = { ...prev };
                delete updated[nodeId];
                return updated;
            });
            setSelectedNodes(prev => prev.filter(id => id !== nodeId));

            console.log('Node removal completed');
        } catch (error) {
            console.error('Error removing node:', error);
        }
    }, []);

    const selectNode = useCallback((nodeId) => {
        setSelectedNodes((prev) => {
            const existingIndex = prev.indexOf(nodeId);
            if (existingIndex !== -1) {
                prev.slice(existingIndex).forEach((id) => {
                    if (markersRef.current[id]) {
                        markersRef.current[id].setIcon(DefaultIcon);
                    }
                });
                setRouteConnections((prevConnections) =>
                    prevConnections.filter(
                        (conn) => !(conn.node1 === nodeId || conn.node2 === nodeId),
                    ),
                );
                return prev.slice(0, existingIndex);
            }

            const newSelected = [...prev, nodeId];
            if (markersRef.current[nodeId]) {
                markersRef.current[nodeId].setIcon(SelectedIcon);
            }

            if (newSelected.length >= 2) {
                const lastIndex = newSelected.length - 1;
                const node1 = newSelected[lastIndex - 1];
                const node2 = newSelected[lastIndex];

                if (!checkRouteExists(routeConnections, node1, node2, nodeRoadNames)) {
                    createRoute(node1, node2).then((routeId) => {
                        if (routeId) {
                            setRouteConnections((prev) => {
                                if (!checkRouteExists(prev, node1, node2, nodeRoadNames)) {
                                    return [...prev, { node1, node2, routeId }];
                                }
                                return prev;
                            });
                        }
                    });
                }
            }

            return newSelected;
        });
    }, [routeConnections, nodeRoadNames, createRoute]);

    const handleMapClick = useCallback(async (e) => {
        if (!isNodePlacementEnabled) return;

        const nodeId = `node_${nodeCounter}`;
        setNodeCounter(prev => prev + 1);

        const marker = L.marker(e.latlng, {
            title: `Node ${nodeId}`,
        }).addTo(mapInstanceRef.current);

        const roadName = await fetchRoadName(e.latlng.lat, e.latlng.lng);
        setNodeRoadNames(prev => ({
            ...prev,
            [nodeId]: roadName,
        }));

        const popupContent = createPopupContent(nodeId, marker, selectNode, handleNodeRemove);
        marker.bindPopup(popupContent);
        marker.on('click', () => marker.openPopup());

        markersRef.current[nodeId] = marker;
        setNodes(prev => [...prev, { id: nodeId, lat: e.latlng.lat, lng: e.latlng.lng }]);
    }, [isNodePlacementEnabled, nodeCounter, createPopupContent, selectNode, handleNodeRemove]);

    const clearAllSelections = () => {
        selectedNodes.forEach(nodeId => {
            markersRef.current[nodeId].setIcon(DefaultIcon);
        });
        setSelectedNodes([]);
        routingServiceRef.current.clearAllRoutes();
        setLinks([]);
        setRouteConnections([]);
        setNodeCounter(1);
        setRouteCounter(1);
        setTrafficData({});
    };

    return {
        error,
        isNodePlacementEnabled,
        setIsNodePlacementEnabled,
        selectedNodes,
        setSelectedNodes,
        nodes,
        setNodes,
        nodeRoadNames,
        setNodeRoadNames,
        routeConnections,
        setRouteConnections,
        nodeCounter,
        setNodeCounter,
        showTrafficFlow,
        setShowTrafficFlow,
        trafficData,
        mapRef,
        mapInstanceRef,
        markersRef,
        linesRef,
        clickListenerRef,
        routingServiceRef,
        trafficServiceRef,
        updateTrafficFlow,
        createRoute,
        handleNodeRemove,
        handleMapClick,
        selectNode,
        clearAllSelections,
        createPopupContent,
    };
};
