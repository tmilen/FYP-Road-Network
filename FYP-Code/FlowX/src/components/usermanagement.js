import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import styles from '../css/uploadmap.module.css';

const useUploadMap = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');
    const [uploadedData, setUploadedData] = useState(null);
    const [mapsList, setMapsList] = useState([]);
    const [selectedMap, setSelectedMap] = useState('');
    const API_URL = process.env.REACT_APP_API_URL;
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isRemovingMode, setIsRemovingMode] = useState(false);
    const [drawingStart, setDrawingStart] = useState(null);
    const [isSignalMode, setIsSignalMode] = useState(false);
    const [trafficSignals, setTrafficSignals] = useState([]);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [selectedBaseModel, setSelectedBaseModel] = useState(null);
    const [modelsList, setModelsList] = useState([]);
    const [isEditMode, setIsEditMode] = useState(false);
    const [roadNetworks, setRoadNetworks] = useState([]);
    const [vehicles, setVehicles] = useState([]);
    const [isSimulationRunning, setIsSimulationRunning] = useState(false);
    const [isSimulating, setIsSimulating] = useState(false);
    const [simulationInterval, setSimulationInterval] = useState(null);
    const [graph, setGraph] = useState(new Map());
    const [nodes, setNodes] = useState([]);

    const fetchMapsList = async () => {
        try {
            console.log("Fetching maps list...");  // Debug log
            const response = await axios.get(`${API_URL}/maps`, { withCredentials: true });
            console.log("Maps received:", response.data);  // Debug log
            setMapsList(response.data);
        } catch (error) {
            toast.error('Error fetching maps list.');
        }
    };



    useEffect(() => {
        // Check session and fetch maps list
        const initializeData = async () => {
            try {
                const sessionResponse = await axios.get(`${API_URL}/session`, { withCredentials: true });
                if (!sessionResponse.data.username) {
                    toast.error('You must be logged in to upload files.');
                    return;
                }
                await fetchMapsList();
            } catch (error) {
                toast.error('Error fetching session data. Please log in.');
            }
        };

        initializeData();
    }, [API_URL]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/xml') {
            setSelectedFile(file);
            setUploadMessage('');
        } else {
            setSelectedFile(null);
            toast.error('Please select a valid XML file.');
        }
    };

    const processMapXML = (xmlContent) => {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
        
        // Get all paths from the SVG
        const paths = xmlDoc.querySelectorAll('path');
        
        // Assign road IDs sequentially
        paths.forEach((path, index) => {
            path.id = `road_${index + 1}`;
        });

        // Count total roads
        const roadCount = paths.length;

        // Convert back to string
        const serializer = new XMLSerializer();
        const processedXML = serializer.serializeToString(xmlDoc);

        return {
            processedXML,
            roadCount
        };
    };

    const handleFileUpload = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            toast.error('Please select a file to upload.');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await axios.post(`${API_URL}/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    withCredentials: true
                });
                
                toast.success(response.data.message);
                setSelectedFile(null);
                fetchMapsList();
            } catch (error) {
                toast.error('Error uploading file: ' + (error.response?.data?.message || error.message));
            }
        } catch (error) {
            toast.error('Error processing file: ' + error.message);
        }
    };

    // Helper function to clean SVG
    const cleanSvg = (svgElement) => {
        const clone = svgElement.cloneNode(true);
        
        // Remove any existing IDs to avoid conflicts
        const elementsWithId = clone.querySelectorAll('[id]');
        elementsWithId.forEach(el => el.removeAttribute('id'));
        
        // Remove any unwanted attributes or elements
        clone.removeAttribute('xmlns:ns0');
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        
        return clone;
    };

    const handleDisplayMap = async () => {
        if (!selectedMap) return;

        try {
            // First get the SVG content
            const fileResponse = await axios.get(`${API_URL}/files/${selectedMap}`, { withCredentials: true });
            
            // Then get the road network data that contains signals, entrances, exits
            const networkResponse = await axios.get(`${API_URL}/road-network/${selectedMap}`, { withCredentials: true });
            
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(fileResponse.data.data, 'text/xml');
            let svgElement = xmlDoc.querySelector('svg') || 
                            xmlDoc.querySelector('ns0\\:svg') ||
                            xmlDoc.querySelector('town map svg') ||
                            xmlDoc.querySelector('town map ns0\\:svg');

            if (!svgElement) {
                toast.error('Could not find SVG element in the map file');
                return;
            }

            // Clean and prepare SVG
            const cleanedSvg = cleanSvg(svgElement);
            
            cleanedSvg.setAttribute('class', 'map-svg');
            cleanedSvg.setAttribute('width', '100%');
            cleanedSvg.setAttribute('height', '100%');
            cleanedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Create groups in specific order
            const createOrGetGroup = (id) => {
                let group = cleanedSvg.querySelector(`#${id}`);
                if (!group) {
                    group = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    group.setAttribute('id', id);
                    cleanedSvg.appendChild(group);
                } else {
                    // Clear existing content if group exists
                    group.innerHTML = '';
                }
                return group;
            };

            // Create groups in specific order (bottom to top layer)
            const roadsGroup = createOrGetGroup('roads');
            const intersectionNodesGroup = createOrGetGroup('intersection-nodes');
            const signalsGroup = createOrGetGroup('traffic-signals');

            // First, add road paths if they exist
            if (networkResponse.data.road_segments && Array.isArray(networkResponse.data.road_segments)) {
                // Remove 3 specific non-main roads from bikini_bottom.xml
                const roadsToRemove = ['road_3', 'road_7', 'road_9']; // These are side roads in bikini_bottom.xml
                
                networkResponse.data.road_segments.forEach((segment, index) => {
                    if (segment && Array.isArray(segment.start) && Array.isArray(segment.end) && 
                        segment.start.length >= 2 && segment.end.length >= 2) {
                        
                        const roadId = `road_${index + 1}`;
                        if (!roadsToRemove.includes(roadId)) {
                            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                            const d = `M${segment.start[0]},${segment.start[1]} L${segment.end[0]},${segment.end[1]}`;
                            path.setAttribute('d', d);
                            path.setAttribute('id', roadId);
                            path.setAttribute('stroke', '#2c3e50');
                            path.setAttribute('stroke-width', '30');
                            path.setAttribute('stroke-linecap', 'round');
                            roadsGroup.appendChild(path);
                        }
                    }
                });
            }

            // Then, add intersection nodes
            if (networkResponse.data.intersections && Array.isArray(networkResponse.data.intersections)) {
                networkResponse.data.intersections.forEach((intersection, index) => {
                    if (Array.isArray(intersection) && intersection.length >= 2) {
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute('id', `node_${index + 1}`);
                        circle.setAttribute('cx', intersection[0]);
                        circle.setAttribute('cy', intersection[1]);
                        circle.setAttribute('r', '6');
                        circle.setAttribute('fill', '#ffffff');
                        circle.setAttribute('stroke', '#2c3e50');
                        circle.setAttribute('stroke-width', '2');
                        intersectionNodesGroup.appendChild(circle);
                    }
                });
            }

            // Add entrances
            if (networkResponse.data.entrances && Array.isArray(networkResponse.data.entrances)) {
                networkResponse.data.entrances.forEach((entrance, index) => {
                    // Handle both array format and object format
                    let position;
                    if (Array.isArray(entrance)) {
                        position = entrance;
                    } else if (entrance.position) {
                        position = entrance.position;
                    } else if ('x' in entrance && 'y' in entrance) {
                        position = [entrance.x, entrance.y];
                    }

                    if (position && position.length >= 2) {
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute('id', `entrance_${index + 1}`);
                        circle.setAttribute('cx', position[0]);
                        circle.setAttribute('cy', position[1]);
                        circle.setAttribute('r', '8');
                        circle.setAttribute('class', 'entrance');
                        circle.setAttribute('fill', '#2ecc71');
                        circle.setAttribute('stroke', '#27ae60');
                        circle.setAttribute('stroke-width', '2');
                        intersectionNodesGroup.appendChild(circle);
                    }
                });
            }

            // Add exits
            if (networkResponse.data.exits && Array.isArray(networkResponse.data.exits)) {
                networkResponse.data.exits.forEach((exit, index) => {
                    // Handle both array format and object format
                    let position;
                    if (Array.isArray(exit)) {
                        position = exit;
                    } else if (exit.position) {
                        position = exit.position;
                    } else if ('x' in exit && 'y' in exit) {
                        position = [exit.x, exit.y];
                    }

                    if (position && position.length >= 2) {
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute('id', `exit_${index + 1}`);
                        circle.setAttribute('cx', position[0]);
                        circle.setAttribute('cy', position[1]);
                        circle.setAttribute('r', '8');
                        circle.setAttribute('class', 'exit');
                        circle.setAttribute('fill', '#e74c3c');
                        circle.setAttribute('stroke', '#c0392b');
                        circle.setAttribute('stroke-width', '2');
                        intersectionNodesGroup.appendChild(circle);
                    }
                });
            }

            // Finally, add traffic signals
            if (networkResponse.data.traffic_signals && Array.isArray(networkResponse.data.traffic_signals)) {
                networkResponse.data.traffic_signals.forEach((signal, index) => {
                    let x, y;
                    if (Array.isArray(signal.position)) {
                        [x, y] = signal.position;
                    } else {
                        x = signal.x;
                        y = signal.y;
                    }

                    if (x !== undefined && y !== undefined) {
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute('id', signal.id || `signal_${index + 1}`);
                        circle.setAttribute('cx', x);
                        circle.setAttribute('cy', y);
                        circle.setAttribute('r', '6');
                        circle.setAttribute('fill', '#f1c40f');
                        circle.setAttribute('stroke', '#f39c12');
                        circle.setAttribute('stroke-width', '2');
                        circle.setAttribute('class', 'traffic-signal');
                        signalsGroup.appendChild(circle);
                    }
                });
            }

            // Update component state
            setUploadedData({
                svgContent: cleanedSvg.outerHTML,
                roadCount: (networkResponse.data.road_segments && Array.isArray(networkResponse.data.road_segments)) 
                    ? networkResponse.data.road_segments.length 
                    : 0,
                roadMapping: fileResponse.data.route_mapping || {},
                networkData: networkResponse.data,
                trafficSignals: networkResponse.data.traffic_signals || []
            });

            // Also update trafficSignals state
            setTrafficSignals(networkResponse.data.traffic_signals || []);

            toast.success('Map displayed successfully');

        } catch (error) {
            console.error("Error displaying map:", error);
            toast.error('Error displaying map: ' + error.message);
        }
    };

    const handleDeleteMap = async () => {
        if (!selectedMap) return;

        // Show confirmation dialog using toast
        const toastId = toast(
            <div>
                <p className={styles.confirmMessage}>Are you sure you want to delete this map?</p>
                <div className={styles.confirmButtons}>
                    <button
                        onClick={async () => {
                            try {
                                await axios.delete(`${API_URL}/files/${selectedMap}`, { withCredentials: true });
                                setSelectedMap('');
                                setUploadedData(null);
                                toast.success('Map deleted successfully');
                                await fetchMapsList();
                            } catch (error) {
                                toast.error('Error deleting map: ' + error.message);
                            }
                            toast.dismiss(toastId);
                        }}
                        className={styles.confirmYes}
                    >
                        Yes, delete it
                    </button>
                    <button
                        onClick={() => toast.dismiss(toastId)}
                        className={styles.confirmNo}
                    >
                        Cancel
                    </button>
                </div>
            </div>,
            {
                position: "top-center",
                autoClose: false,
                closeButton: false,
                draggable: false,
                closeOnClick: false,
            }
        );
    };

    const handleClearMap = () => {
        setUploadedData(null);
        toast.info('Map cleared');
    };

    const handleAddRoadClick = () => {
        if (!isEditMode) {
            toast.warn('Please enable edit mode first');
            return;
        }
    
        console.log('Current drawing mode:', isDrawingMode);
        setIsDrawingMode(prev => {
            const newValue = !prev;
            if (newValue) {
                setIsRemovingMode(false);
                toast.info('Drawing mode enabled. Click to start drawing a road.');
            } else {
                toast.info('Drawing mode disabled.');
            }
            console.log('Setting drawing mode to:', newValue);
            return newValue;
        });
        
        if (isDrawingMode) {
            setDrawingStart(null);
        }
    };
    
    const handleRemoveRoadClick = () => {
        if (!isEditMode) {
            toast.warn('Please enable edit mode first');
            return;
        }
    
        console.log('Current removing mode:', isRemovingMode);
        setIsRemovingMode(prev => {
            const newValue = !prev;
            if (newValue) {
                setIsDrawingMode(false);
                toast.info('Remove mode enabled. Click on a road to remove it.');
            } else {
                toast.info('Remove mode disabled.');
            }
            console.log('Setting removing mode to:', newValue);
            return newValue;
        });
        
        if (isRemovingMode) {
            setDrawingStart(null);
        }
    };

    const handleMapClick = (e) => {
        // Check if in edit mode and clicked on a traffic signal
        if (isEditMode && e.target.classList.contains('traffic-signal')) {
            const signal = e.target;
            toast(
                <div className={styles.nodeOptionsToast}>
                    <h4>Traffic Signal Options</h4>
                    <div className={styles.nodeOptionsButtons}>
                        <button 
                            className={`${styles.nodeOptionButton} ${styles.exitButton}`}
                            onClick={() => {
                                signal.remove();
                                setTrafficSignals(prev => 
                                    prev.filter(s => s.id !== signal.getAttribute('id'))
                                );
                                setUnsavedChanges(true);
                                toast.dismiss();
                                toast.success('Traffic signal removed');
                            }}
                        >
                            Delete Signal
                        </button>
                        <button 
                            className={`${styles.nodeOptionButton} ${styles.cancelButton}`}
                            onClick={() => toast.dismiss()}
                        >
                            Cancel
                        </button>
                    </div>
                </div>,
                {
                    position: "top-center",
                    autoClose: false,
                    closeOnClick: false,
                    draggable: false,
                    closeButton: false,
                }
            );
            return;
        }

        if (isSignalMode) {
            const svg = e.target.ownerSVGElement || e.target;
            if (svg) {
                // Add signal directly to the features
                const signalsGroup = svg.querySelector('#traffic-signals') || 
                                   createSignalsGroup(svg);
                
                // Get coordinates
                const svgRect = svg.getBoundingClientRect();
                const viewBox = svg.getAttribute('viewBox')?.split(' ').map(Number) || [0, 0, 800, 600];
                
                const x = ((e.clientX - svgRect.left) / svgRect.width) * viewBox[2];
                const y = ((e.clientY - svgRect.top) / svgRect.height) * viewBox[3];

                const newSignal = {
                    id: `signal_${trafficSignals.length + 1}`,
                    x: x,
                    y: y,
                    cycleTime: 8.0,
                    offset: trafficSignals.length * 2.0
                };

                setTrafficSignals(prev => [...prev, newSignal]);
                setUnsavedChanges(true);
                
                // Add signal visually
                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', '6');
                circle.setAttribute('fill', '#f1c40f');
                circle.setAttribute('stroke', '#f39c12');
                circle.setAttribute('stroke-width', '2');
                circle.setAttribute('class', 'traffic-signal');
                circle.setAttribute('id', newSignal.id);
                signalsGroup.appendChild(circle);

                toast.success('Traffic signal added');
            }
            return;
        }

        const clickedElement = e.target;
        
        // Add edit mode check for node selection
        if (isEditMode && clickedElement.tagName === 'circle' && clickedElement.parentElement.id === 'intersection-nodes') {
            const node = {
                id: clickedElement.id,
                element: clickedElement
            };

            toast(
                <div className={styles.nodeOptionsToast}>
                    <h4>Set Node Type</h4>
                    <div className={styles.nodeOptionsButtons}>
                        <button 
                            className={`${styles.nodeOptionButton} ${styles.entranceButton}`}
                            onClick={() => {
                                setNodeAsEntrance(node);
                                toast.dismiss();
                            }}
                        >
                            Entrance
                        </button>
                        <button 
                            className={`${styles.nodeOptionButton} ${styles.exitButton}`}
                            onClick={() => {
                                setNodeAsExit(node);
                                toast.dismiss();
                            }}
                        >
                            Exit
                        </button>
                        <button 
                            className={`${styles.nodeOptionButton} ${styles.removeTypeButton}`}
                            onClick={() => {
                                removeNodeType(node);
                                toast.dismiss();
                            }}
                        >
                            Remove Type
                        </button>
                        <button 
                            className={`${styles.nodeOptionButton} ${styles.cancelButton}`}
                            onClick={() => toast.dismiss()}
                        >
                            Cancel
                        </button>
                    </div>
                </div>,
                {
                    position: "top-center",
                    autoClose: false,
                    closeOnClick: false,
                    draggable: false,
                    closeButton: false,
                }
            );
            return;
        }

        // Handle other map clicks (existing logic)
        if (!isDrawingMode && !isRemovingMode) return;
        
        const findSVGElement = (element) => {
            while (element && element.tagName !== 'svg') {
                element = element.parentElement;
            }
            return element;
        };

        const svg = findSVGElement(e.target);
        if (!svg) return;

        if (isRemovingMode) {
            // Handle road removal with improved path finding
            const clickedElement = e.target;
            let roadToRemove = null;

            // If clicked directly on a path
            if (clickedElement.tagName === 'path' && clickedElement.parentElement.id === 'roads') {
                roadToRemove = clickedElement;
            } else {
                // If clicked near a path, find the closest one
                const roads = svg.querySelectorAll('#roads path');
                const point = svg.createSVGPoint();
                
                // Get click coordinates relative to SVG
                const svgRect = svg.getBoundingClientRect();
                const x = e.clientX - svgRect.left;
                const y = e.clientY - svgRect.top;
                
                // Convert to SVG coordinates
                let viewBox = svg.getAttribute('viewBox');
                let scaledX = x;
                let scaledY = y;
                
                if (viewBox) {
                    viewBox = viewBox.split(' ').map(Number);
                    const scaleX = viewBox[2] / svgRect.width;
                    const scaleY = viewBox[3] / svgRect.height;
                    scaledX = x * scaleX;
                    scaledY = y * scaleY;
                }

                point.x = scaledX;
                point.y = scaledY;

                // Find the closest road
                let closestDistance = Infinity;
                roads.forEach(road => {
                    const bbox = road.getBBox();
                    const centerX = bbox.x + bbox.width / 2;
                    const centerY = bbox.y + bbox.height / 2;
                    const distance = Math.sqrt(
                        Math.pow(centerX - scaledX, 2) + 
                        Math.pow(centerY - scaledY, 2)
                    );

                    if (distance < closestDistance && distance < 50) { // 50 is the click tolerance
                        closestDistance = distance;
                        roadToRemove = road;
                    }
                });
            }

            // Remove the road if found
            if (roadToRemove) {
                console.log('Removing road:', roadToRemove.id);
                roadToRemove.remove();
                
                // Update road count
                if (uploadedData) {
                    setUploadedData(prev => ({
                        ...prev,
                        roadCount: Math.max((prev.roadCount || 0) - 1, 0)
                    }));
                }

                // Show feedback message
                toast.success('Road removed successfully');
            }
            return;
        }

        console.log('Map clicked in drawing mode');
    
        // Get the SVG's bounding rectangle
        const svgRect = svg.getBoundingClientRect();
        
        // Calculate relative coordinates
        const x = e.clientX - svgRect.left;
        const y = e.clientY - svgRect.top;
        
        // Scale coordinates based on viewBox if it exists
        let viewBox = svg.getAttribute('viewBox');
        let scaledX = x;
        let scaledY = y;
        
        if (viewBox) {
            viewBox = viewBox.split(' ').map(Number);
            const scaleX = viewBox[2] / svgRect.width;
            const scaleY = viewBox[3] / svgRect.height;
            scaledX = x * scaleX;
            scaledY = y * scaleY;
        }
    
        console.log('Clicked coordinates:', { scaledX, scaledY });
    
        if (!drawingStart) {
            // First click - set starting point
            console.log('Setting start point');
            setDrawingStart({ x: scaledX, y: scaledY });
        } else {
            // Second click - create road
            console.log('Creating road');
            const roadGroup = svg.querySelector('#roads');
            const nodesGroup = svg.querySelector('#intersection-nodes') || createIntersectionNodesGroup(svg);
            
            if (roadGroup) {
                // Find intersections with existing roads
                const intersectionPoints = [];
                const existingRoads = Array.from(roadGroup.querySelectorAll('path'));
                
                existingRoads.forEach(road => {
                    const d = road.getAttribute('d');
                    const [start, end] = d.replace('M', '').split('L').map(point => {
                        const [x, y] = point.split(',').map(Number);
                        return { x, y };
                    });

                    const intersection = findIntersection(
                        drawingStart.x, drawingStart.y,
                        scaledX, scaledY,
                        start.x, start.y,
                        end.x, end.y
                    );

                    if (intersection) {
                        intersectionPoints.push(intersection);
                    }
                });

                // Sort intersection points by distance from start
                intersectionPoints.sort((a, b) => {
                    const distA = Math.hypot(a.x - drawingStart.x, a.y - drawingStart.y);
                    const distB = Math.hypot(b.x - drawingStart.x, b.y - drawingStart.y);
                    return distA - distB;
                });

                // Create the road segments including intersection points
                const points = [drawingStart, ...intersectionPoints, { x: scaledX, y: scaledY }];
                for (let i = 0; i < points.length - 1; i++) {
                    const start = points[i];
                    const end = points[i + 1];

                    const pathSegment = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    pathSegment.setAttribute("d", `M${start.x},${start.y} L${end.x},${end.y}`);
                    pathSegment.setAttribute("stroke", "#2c3e50");
                    pathSegment.setAttribute("stroke-width", "30");
                    pathSegment.setAttribute("stroke-linecap", "round");
                    pathSegment.setAttribute("fill", "none");
                    
                    const roadId = `road_${roadGroup.querySelectorAll('path').length + 1}_${i + 1}`;
                    pathSegment.setAttribute("id", roadId);
                    
                    roadGroup.appendChild(pathSegment);
                }

                // Add intersection nodes
                intersectionPoints.forEach((point, index) => {
                    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                    circle.setAttribute('id', `node_${nodesGroup.querySelectorAll('circle').length + 1}`);
                    circle.setAttribute('cx', point.x);
                    circle.setAttribute('cy', point.y);
                    circle.setAttribute('r', '6');
                    circle.setAttribute('fill', '#ffffff');
                    circle.setAttribute('stroke', '#2c3e50');
                    circle.setAttribute('stroke-width', '2');
                    nodesGroup.appendChild(circle);
                });

                // Update road count and set unsavedChanges
                if (uploadedData) {
                    setUploadedData(prev => ({
                        ...prev,
                        roadCount: (prev.roadCount || 0) + 1
                    }));
                }
                setUnsavedChanges(true);
                toast.success('Road added successfully');
            }

            // Reset drawing state
            setDrawingStart(null);
        }
    };

    const setNodeAsEntrance = (node) => {
        if (node && node.element) {
            node.element.classList.remove('exit');
            node.element.classList.add('entrance');
            setUnsavedChanges(true);
        }
    };

    const setNodeAsExit = (node) => {
        if (node && node.element) {
            node.element.classList.remove('entrance');
            node.element.classList.add('exit');
            setUnsavedChanges(true);
        }
    };

    const removeNodeType = (node) => {
        if (node && node.element) {
            node.element.classList.remove('entrance', 'exit');
            node.element.setAttribute('fill', '#ffffff');
            node.element.setAttribute('stroke', '#2c3e50');
        }
    };

    const handleAddSignalClick = () => {
        if (!isEditMode) {
            toast.warn('Please enable edit mode first');
            return;
        }
        setIsSignalMode(prev => !prev);
        if (!isSignalMode) {
            toast.info('Traffic signal placement mode enabled. Click to place signals.');
        } else {
            toast.info('Traffic signal placement mode disabled.');
        }
    };

    const handleBaseModelChange = (event) => {
        const file = event.target.files[0];
        if (file && file.name.endsWith('.pkl')) {
            setSelectedBaseModel(file);
        } else {
            setSelectedBaseModel(null);
            toast.error('Please select a valid .pkl file.');
        }
    };



    const handleEditModeClick = () => {
        if (isEditMode) {
            if (unsavedChanges) {
                // Show confirmation dialog using toast
                toast(
                    <div className={styles.nodeOptionsToast}>
                        <h4>Save Changes?</h4>
                        <p>Do you want to save the changes you made to the map?</p>
                        <div className={styles.nodeOptionsButtons}>
                            <button 
                                className={`${styles.nodeOptionButton} ${styles.entranceButton}`}
                                onClick={async () => {
                                    await handleSaveMapChanges();
                                    setIsEditMode(false);
                                    setIsDrawingMode(false);
                                    setIsRemovingMode(false);
                                    setIsSignalMode(false);
                                    toast.dismiss();
                                }}
                            >
                                Save Changes
                            </button>
                            <button 
                                className={`${styles.nodeOptionButton} ${styles.exitButton}`}
                                onClick={() => {
                                    setIsEditMode(false);
                                    setIsDrawingMode(false);
                                    setIsRemovingMode(false);
                                    setIsSignalMode(false);
                                    setUnsavedChanges(false);
                                    toast.dismiss();
                                    toast.info('Changes discarded');
                                }}
                            >
                                Discard Changes
                            </button>
                            <button 
                                className={`${styles.nodeOptionButton} ${styles.cancelButton}`}
                                onClick={() => toast.dismiss()}
                            >
                                Keep Editing
                            </button>
                        </div>
                    </div>,
                    {
                        position: "top-center",
                        autoClose: false,
                        closeOnClick: false,
                        draggable: false,
                        closeButton: false,
                    }
                );
                return;
            }
            setIsEditMode(false);
            setIsDrawingMode(false);
            setIsRemovingMode(false);
            setIsSignalMode(false);
            toast.info('Edit mode disabled');
        } else {
            setIsEditMode(true);
            setIsDrawingMode(false);
            setIsRemovingMode(false);
            setIsSignalMode(false);
            toast.info('Edit mode enabled. You can now add or remove roads.');
        }
    };

    const handleSaveMapChanges = async () => {
        try {
            const svg = document.querySelector('.map-svg');
            if (!svg) {
                toast.error('No map loaded');
                return;
            }

            // Collect roads
            const roads = Array.from(svg.querySelectorAll('#roads path')).map(path => ({
                id: path.getAttribute('id'),
                d: path.getAttribute('d'),
                stroke: path.getAttribute('stroke'),
                strokeWidth: path.getAttribute('stroke-width')
            }));

            // Collect traffic signals with their current states
            const signals = Array.from(svg.querySelectorAll('#traffic-signals circle')).map(circle => ({
                id: circle.getAttribute('id'),
                x: parseFloat(circle.getAttribute('cx')),
                y: parseFloat(circle.getAttribute('cy')),
                cycleTime: 8.0,
                offset: 0.0,
                currentState: {
                    fill: circle.getAttribute('fill'),
                    stroke: circle.getAttribute('stroke')
                }
            }));

            // Collect entrance nodes
            const entrances = Array.from(svg.querySelectorAll('#intersection-nodes .entrance')).map(node => ({
                id: node.getAttribute('id'),
                x: parseFloat(node.getAttribute('cx')),
                y: parseFloat(node.getAttribute('cy'))
            }));

            // Collect exit nodes
            const exits = Array.from(svg.querySelectorAll('#intersection-nodes .exit')).map(node => ({
                id: node.getAttribute('id'),
                x: parseFloat(node.getAttribute('cx')),
                y: parseFloat(node.getAttribute('cy'))
            }));

            // Get current SVG content
            const svgContent = svg.outerHTML;

            // Debug log
            console.log('Saving map changes:', {
                roads: roads.length,
                signals: signals.length,
                entrances: entrances.length,
                exits: exits.length
            });

            // Send to backend
            const response = await axios.post(
                `${API_URL}/save-map-changes/${selectedMap}`,
                {
                    svgContent,
                    roads,
                    signals,
                    entrances,
                    exits
                },
                { withCredentials: true }
            );

            setUnsavedChanges(false);
            setIsEditMode(false);
            toast.success('Map changes saved successfully');

        } catch (error) {
            console.error('Error saving map changes:', error);
            toast.error('Error saving map changes: ' + error.message);
        }
    };

    const toggleTrafficSimulation = () => {
        if (!isSimulating) {
            startSimulation();
        } else {
            stopSimulation();
        }
    };

    // Helper function to find nearest node to a point - Move this BEFORE startSimulation
    const findNearestNode = (nodes, point) => {
        return nodes.reduce((nearest, node) => {
            const distance = Math.hypot(node.x - point.x, node.y - point.y);
            if (!nearest || distance < nearest.distance) {
                return { ...node, distance };
            }
            return nearest;
        }, null);
    };

    // Create vehicle helper function - Move this BEFORE startSimulation
    const createVehicle = (path) => {
        const vehicle = document.createElementNS("http://www.w3.org/2000/svg", "g");
        vehicle.setAttribute('class', 'vehicle');
        
        const body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        body.setAttribute('r', '8');
        body.setAttribute('fill', '#007fff');
        body.setAttribute('stroke-width', '2');
        vehicle.appendChild(body);
        
        vehicle.setAttribute('transform', `translate(${path[0][0]},${path[0][1]})`);
        
        let pathIndex = 0;
        let progress = 0;
        const SPEED = 0.005;
        const STOP_DISTANCE = 25;  // Distance to stop before signal
        const VEHICLE_GAP = 25;    // Reduced from 40 to 25 for closer following distance
        
        const getPosition = (p) => {
            const start = path[pathIndex];
            const end = path[pathIndex + 1];
            return {
                x: start[0] + (end[0] - start[0]) * p,
                y: start[1] + (end[1] - start[1]) * p
            };
        };

        const distanceTo = (x1, y1, x2, y2) => {
            return Math.sqrt((x2 - y1) ** 2 + (y2 - y1) ** 2);
        };

        const shouldStop = (currX, currY, nextX, nextY) => {
            // Check for red lights
            const signals = document.querySelectorAll('#traffic-signals circle');
            for (const signal of signals) {
                const signalX = parseFloat(signal.getAttribute('cx'));
                const signalY = parseFloat(signal.getAttribute('cy'));
                
                // Calculate distance to signal using proper coordinates
                const distanceToSignal = Math.sqrt(
                    Math.pow(currX - signalX, 2) + 
                    Math.pow(currY - signalY, 2)
                );

                if (distanceToSignal < STOP_DISTANCE) {
                    // Calculate direction vectors
                    const movementVector = {
                        x: nextX - currX,
                        y: nextY - currY
                    };
                    const toSignalVector = {
                        x: signalX - currX,
                        y: signalY - currY
                    };
                    
                    // Normalize vectors
                    const movementLength = Math.sqrt(movementVector.x * movementVector.x + movementVector.y * movementVector.y);
                    const toSignalLength = Math.sqrt(toSignalVector.x * toSignalVector.x + toSignalVector.y * toSignalVector.y);
                    
                    const normalizedMovement = {
                        x: movementVector.x / movementLength,
                        y: movementVector.y / movementLength
                    };
                    const normalizedToSignal = {
                        x: toSignalVector.x / toSignalLength,
                        y: toSignalVector.y / toSignalLength
                    };
                    
                    // Calculate dot product
                    const dotProduct = normalizedMovement.x * normalizedToSignal.x + 
                                     normalizedMovement.y * normalizedToSignal.y;
                    
                    // Check if signal is ahead of vehicle (dot product > 0.7 means angle < 45 degrees)
                    if (dotProduct > 0.7 && signal.getAttribute('fill') === '#ff0000') {
                        return true;
                    }
                }
            }

            // Check for vehicles ahead
            const vehicles = document.querySelectorAll('.vehicle');
            const currentPosition = { x: currX, y: currY };
            const movement = {
                x: nextX - currX,
                y: nextY - currY
            };
            const movementLength = Math.sqrt(movement.x * movement.x + movement.y * movement.y);
            const normalizedMovement = {
                x: movement.x / movementLength,
                y: movement.y / movementLength
            };

            for (const other of vehicles) {
                if (other === vehicle) continue;

                const transform = other.getAttribute('transform');
                const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
                if (!match) continue;

                const otherX = parseFloat(match[1]);
                const otherY = parseFloat(match[2]);
                
                const vectorToOther = {
                    x: otherX - currX,
                    y: otherY - currY
                };

                // Calculate distance to other vehicle
                const distanceToVehicle = Math.sqrt(
                    vectorToOther.x * vectorToOther.x + 
                    vectorToOther.y * vectorToOther.y
                );

                if (distanceToVehicle < VEHICLE_GAP) {
                    // Calculate dot product to check if vehicle is ahead
                    const dotProduct = (vectorToOther.x * normalizedMovement.x + 
                                      vectorToOther.y * normalizedMovement.y);
                    
                    // Check if the other vehicle is roughly in our path (within 45 degrees)
                    // and is ahead of us (positive dot product)
                    if (dotProduct > 0 && dotProduct / distanceToVehicle > 0.7) {
                        return true;
                    }
                }
            }

            return false;
        };

        const animate = () => {
            // Remove extra parentNode check that was causing delay
            const current = getPosition(progress);
            const next = getPosition(progress + SPEED);

            // Check end condition first
            if (pathIndex >= path.length - 2 || !vehicle.parentNode) {
                cancelAnimationFrame(vehicle._animationFrame);
                vehicle.remove();
                return;
            }

            if (!shouldStop(current.x, current.y, next.x, next.y)) {
                progress += SPEED;
                if (progress >= 1) {
                    pathIndex++;
                    progress = 0;
                }
                vehicle.setAttribute('transform', `translate(${current.x},${current.y})`);
            }

            vehicle._animationFrame = requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
        return vehicle;
    };

    // Add these helper functions before startSimulation()
    const calculateDistance = (point1, point2) => {
        return Math.sqrt(
            Math.pow(point2.x - point1.x, 2) + 
            Math.pow(point2.y - point1.y, 2)
        );
    };

    const calculateHeuristic = (node, goal) => {
        return calculateDistance(
            { x: node.x, y: goal.x },
            { x: node.y, y: goal.y }
        );
    };

    // Replace the existing findPath function with A* implementation
    const findPath = (startNode, endNode, graph, nodesList) => {
        try {
            if (!startNode || !endNode || !graph || !nodesList || nodesList.length === 0) {
                console.error("Invalid parameters:", { 
                    startNode, 
                    endNode, 
                    graphSize: graph?.size,
                    nodesLength: nodesList?.length 
                });
                return null;
            }

            console.log("Finding path between:", startNode, "and", endNode);
            
            // Check for direct path first
            const directDistance = calculateDistance(startNode, endNode);
            if (directDistance < 100) { // Threshold for direct path
                console.log("Using direct path - nodes are close");
                return [startNode, endNode];
            }

            // Random algorithm selection between A*, Dijkstra, and Bellman-Ford
            const randomChoice = Math.random();
            const algorithm = 
                randomChoice < 0.33 ? 'A*' :
                randomChoice < 0.66 ? 'Dijkstra' : 
                'Bellman-Ford';
            
            console.log(`Using ${algorithm} algorithm`);

            switch(algorithm) {
                case 'A*':
                    return findPathAStar(startNode, endNode, graph, nodesList);
                case 'Dijkstra':
                    return findPathDijkstra(startNode, endNode, graph, nodesList);
                case 'Bellman-Ford':
                    return findPathBellmanFord(startNode, endNode, graph, nodesList);
                default:
                    return findPathAStar(startNode, endNode, graph, nodesList);
            }

        } catch (error) {
            console.error("Error in findPath:", error);
            return null;
        }
    };

    const findPathDijkstra = (startNode, endNode, graph, nodesList) => {
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();

        // Initialize distances
        nodesList.forEach(node => {
            distances.set(node.id, Infinity);
            unvisited.add(node.id);
        });
        distances.set(startNode.id, 0);

        while (unvisited.size > 0) {
            // Find node with minimum distance
            let current = null;
            let minDistance = Infinity;
            
            for (const nodeId of unvisited) {
                const distance = distances.get(nodeId);
                if (distance < minDistance) {
                    minDistance = distance;
                    current = nodesList.find(n => n.id === nodeId);
                }
            }

            if (!current) break;
            if (current.id === endNode.id) break;

            unvisited.delete(current.id);

            // Get neighbors from graph and add nearby nodes
            const neighbors = new Set();
            const connectedNeighbors = graph.get(current.id) || [];
            connectedNeighbors.forEach(neighborId => {
                const neighbor = nodesList.find(n => n.id === neighborId);
                if (neighbor) neighbors.add(neighbor);
            });

            // Add nearby nodes not in graph
            nodesList.forEach(node => {
                if (node.id !== current.id) {
                    const distance = calculateDistance(current, node);
                    if (distance < 50) {
                        neighbors.add(node);
                    }
                }
            });

            for (const neighbor of neighbors) {
                if (!unvisited.has(neighbor.id)) continue;
                
                const distance = calculateDistance(current, neighbor);
                const alt = distances.get(current.id) + distance;
                
                if (alt < distances.get(neighbor.id)) {
                    distances.set(neighbor.id, alt);
                    previous.set(neighbor.id, current.id);
                }
            }
        }

        // Reconstruct path
        const path = [];
        let currentId = endNode.id;
        
        while (currentId) {
            const node = nodesList.find(n => n.id === currentId);
            if (!node) break;
            path.unshift(node);
            currentId = previous.get(currentId);
        }

        return path.length > 1 ? path : null;
    };

    const findPathAStar = (startNode, endNode, graph, nodesList) => {
        // Original A* implementation
        const openSet = new Set([startNode.id]);
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        // Initialize scores
        nodesList.forEach(node => {
            gScore.set(node.id, Infinity);
            fScore.set(node.id, Infinity);
        });

        gScore.set(startNode.id, 0);
        fScore.set(startNode.id, calculateHeuristic(startNode, endNode));

        while (openSet.size > 0) {
            // Find node with lowest fScore in openSet
            let current = null;
            let lowestFScore = Infinity;
            
            for (const nodeId of openSet) {
                const score = fScore.get(nodeId);
                if (score < lowestFScore) {
                    lowestFScore = score;
                    current = nodesList.find(n => n.id === nodeId);
                }
            }

            if (!current) break;

            if (current.id === endNode.id) {
                // Reconstruct path
                const path = [current];
                let currentId = current.id;
                while (cameFrom.has(currentId)) {
                    currentId = cameFrom.get(currentId);
                    const node = nodesList.find(n => n.id === currentId);
                    if (!node) break;
                    path.unshift(node);
                }
                console.log("Path found:", path.map(n => n.id).join(' -> '));
                return path;
            }

            openSet.delete(current.id);
            closedSet.add(current.id);

            // Get neighbors from graph and add nearby nodes
            const neighbors = new Set();
            
            // Add connected neighbors from graph
            const connectedNeighbors = graph.get(current.id) || [];
            connectedNeighbors.forEach(neighborId => {
                const neighbor = nodesList.find(n => n.id === neighborId);
                if (neighbor) neighbors.add(neighbor);
            });

            // Add nearby nodes not in graph
            nodesList.forEach(node => {
                if (node.id !== current.id) {
                    const distance = calculateDistance(current, node);
                    if (distance < 50) { // Adjust threshold as needed
                        neighbors.add(node);
                    }
                }
            });

            for (const neighbor of neighbors) {
                if (closedSet.has(neighbor.id)) continue;

                const tentativeGScore = gScore.get(current.id) + calculateDistance(current, neighbor);

                if (!openSet.has(neighbor.id)) {
                    openSet.add(neighbor.id);
                } else if (tentativeGScore >= gScore.get(neighbor.id)) {
                    continue;
                }

                // This path is the best until now. Record it.
                cameFrom.set(neighbor.id, current.id);
                gScore.set(neighbor.id, tentativeGScore);
                fScore.set(neighbor.id, tentativeGScore + calculateHeuristic(neighbor, endNode));
            }
        }

        // If no path found, try to find intermediate points
        console.log("No direct path found, trying intermediate points");
        const midPoint = {
            id: 'mid_point',
            x: (startNode.x + endNode.x) / 2,
            y: (startNode.y + endNode.y) / 2
        };

        return [startNode, midPoint, endNode];

    };

    const findPathBellmanFord = (startNode, endNode, graph, nodesList) => {
        const distances = new Map();
        const previous = new Map();
        
        // Initialize distances
        nodesList.forEach(node => {
            distances.set(node.id, Infinity);
        });
        distances.set(startNode.id, 0);
    
        // Relax edges repeatedly
        for (let i = 0; i < nodesList.length - 1; i++) {
            let updates = false;
            
            nodesList.forEach(node => {
                // Get connected neighbors from the graph
                const connectedNeighbors = Array.from(graph.get(node.id) || []);
                
                // Get nearby nodes
                const nearbyNodes = nodesList.filter(n => {
                    if (n.id === node.id) return false;
                    const dist = calculateDistance(node, n);
                    return dist < 50;
                });
    
                // Combine both types of neighbors
                const allNeighbors = [
                    ...connectedNeighbors.map(id => nodesList.find(n => n.id === id)),
                    ...nearbyNodes
                ].filter(Boolean); // Remove any undefined values
    
                // Process all neighbors
                allNeighbors.forEach(neighbor => {
                    if (!neighbor) return;
                    
                    const distance = calculateDistance(node, neighbor);
                    const newDist = distances.get(node.id) + distance;
                    
                    if (newDist < distances.get(neighbor.id)) {
                        distances.set(neighbor.id, newDist);
                        previous.set(neighbor.id, node.id);
                        updates = true;
                    }
                });
            });
    
            // Early termination if no updates were made
            if (!updates) break;
        }
    
        // Reconstruct path
        const path = [];
        let currentId = endNode.id;
        
        while (currentId) {
            const node = nodesList.find(n => n.id === currentId);
            if (!node) break;
            path.unshift(node);
            currentId = previous.get(currentId);
        }
    
        return path.length > 1 ? path : null;
    };

    // Modify spawnVehicle to use the nodes passed from startSimulation
    const spawnVehicle = (svg, nodesList, graph, vehiclesGroup) => {
        try {
            if (!svg || !nodesList || !graph || !vehiclesGroup) {
                console.error("Missing required parameters for spawnVehicle");
                return;
            }

            const entrances = Array.from(svg.querySelectorAll('.entrance'));
            const exits = Array.from(svg.querySelectorAll('.exit'));
            
            if (entrances.length === 0 || exits.length === 0) {
                console.error("No entrances or exits found");
                return;
            }

            // Randomly select entrance and exit
            const entrance = entrances[Math.floor(Math.random() * entrances.length)];
            const exit = exits[Math.floor(Math.random() * exits.length)];

            // Get coordinates
            const startPos = {
                x: parseFloat(entrance.getAttribute('cx')),
                y: parseFloat(entrance.getAttribute('cy'))
            };

            const endPos = {
                x: parseFloat(exit.getAttribute('cx')),
                y: parseFloat(exit.getAttribute('cy'))
            };

            console.log("Start/End positions:", { startPos, endPos });

            // Find nearest nodes to entrance and exit
            const startNode = findNearestNode(nodesList, startPos);
            const endNode = findNearestNode(nodesList, endPos);

            if (!startNode || !endNode) {
                console.error("Could not find valid path nodes");
                console.log("Start node:", startNode);
                console.log("End node:", endNode);
                console.log("Available nodes:", nodesList);
                return;
            }

            console.log("Using nodes:", { startNode, endNode });

            const nodePath = findPath(startNode, endNode, graph, nodesList);
            if (!nodePath || nodePath.length < 2) {
                console.error("No valid path found between entrance and exit");
                return;
            }

            // Calculate total distance of path
            let totalDistance = 0;
            for (let i = 0; i < nodePath.length - 1; i++) {
                totalDistance += calculateDistance(nodePath[i], nodePath[i + 1]);
            }
            
            console.log(`Created path with total distance: ${totalDistance}`);

            // Create full path including entrance and exit
            const fullPath = [
                [startPos.x, startPos.y],
                ...nodePath.map(node => [node.x, node.y]),
                [endPos.x, endPos.y]
            ];

            console.log(`Creating vehicle with path through ${fullPath.length} points:`, fullPath);
            const vehicle = createVehicle(fullPath);
            
            // Add cleanup function
            vehicle._cleanup = () => {
                if (vehicle._animationFrame) {
                    cancelAnimationFrame(vehicle._animationFrame);
                }
                if (vehicle.parentNode) {
                    vehicle.remove();
                }
            };

            vehiclesGroup.appendChild(vehicle);

        } catch (error) {
            console.error("Error in spawnVehicle:", error);
            console.log("Stack trace:", error.stack);
        }
    };

    const startSimulation = () => {
        try {
            console.log("Starting simulation...");
            const svg = document.querySelector('.map-svg');
            if (!svg) {
                console.error("No SVG element found");
                return;
            }
        
            if (!uploadedData?.networkData?.intersections) {
                console.error("No valid network data available");
                return;
            }
        
            // Create vehicles group if it doesn't exist
            let vehiclesGroup = svg.querySelector('#vehicles');
            if (!vehiclesGroup) {
                vehiclesGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
                vehiclesGroup.setAttribute('id', 'vehicles');
                svg.appendChild(vehiclesGroup);
            }
        
            // Get network data
            const { intersections, road_segments } = uploadedData.networkData;
            console.log("Network data:", { intersections, road_segments });
            
            // Convert intersections to nodes with increased tolerance
            const DISTANCE_THRESHOLD = 50; // Increased from 5 to 50
            const newNodes = intersections.map((intersection, index) => ({
                id: `node_${index + 1}`,
                x: intersection[0],
                y: intersection[1]
            }));
            
            // Build fully connected graph between nearby nodes
            const newGraph = new Map();
            newNodes.forEach(node => {
                newGraph.set(node.id, new Set());
            });

            // Connect all nodes that are close to each other
            for (let i = 0; i < newNodes.length; i++) {
                for (let j = i + 1; j < newNodes.length; j++) {
                    const node1 = newNodes[i];
                    const node2 = newNodes[j];
                    const distance = Math.hypot(node2.x - node1.x, node2.y - node1.y);
                    
                    if (distance <= DISTANCE_THRESHOLD * 4) { // Increased connection range
                        newGraph.get(node1.id).add(node2.id);
                        newGraph.get(node2.id).add(node1.id);
                    }
                }
            }

            // Also connect nodes based on road segments
            road_segments.forEach(segment => {
                const start = { x: segment.start[0], y: segment.start[1] };
                const end = { x: segment.end[0], y: segment.end[1] };
                
                // Find nodes near the start and end points
                const startNodes = newNodes.filter(node => 
                    Math.hypot(node.x - start.x, node.y - start.y) <= DISTANCE_THRESHOLD
                );
                
                const endNodes = newNodes.filter(node => 
                    Math.hypot(node.x - end.x, node.y - end.y) <= DISTANCE_THRESHOLD
                );
                
                // Connect all found nodes
                startNodes.forEach(startNode => {
                    endNodes.forEach(endNode => {
                        if (startNode.id !== endNode.id) {
                            newGraph.get(startNode.id).add(endNode.id);
                            newGraph.get(endNode.id).add(startNode.id);
                        }
                    });
                });
            });
            
            // Log graph connections
            console.log("Graph connections:");
            newGraph.forEach((connections, nodeId) => {
                console.log(`${nodeId} -> ${Array.from(connections).join(', ')}`);
            });
            
            setNodes(newNodes);
            setGraph(newGraph);
            
            const spawnVehicleWrapper = () => {
                spawnVehicle(svg, newNodes, newGraph, vehiclesGroup);
            };
        
            // Increase spawn rate (reduced interval from 2000 to 1000)
            const spawnInterval = setInterval(spawnVehicleWrapper, 1000);
            setSimulationInterval({ spawn: spawnInterval });
            setIsSimulating(true);
            
            // Spawn first vehicle immediately
            spawnVehicleWrapper();
            
            // Add traffic signal animation with fixed timing
            const animateTrafficSignals = () => {
                const signals = svg.querySelectorAll('#traffic-signals circle');
                signals.forEach(signal => {
                    const currentColor = signal.getAttribute('fill');
                    // Toggle between red and green every 12 seconds
                    if (currentColor === '#ff0000' || currentColor === '#f1c40f') {
                        signal.setAttribute('fill', '#00ff00');
                        signal.setAttribute('stroke', '#00cc00');
                    } else {
                        signal.setAttribute('fill', '#ff0000');
                        signal.setAttribute('stroke', '#cc0000');
                    }
                    signal.setAttribute('r', '8');
                });
            };

            // Set signal interval to 12 seconds
            const signalInterval = setInterval(animateTrafficSignals, 12000);
            setSimulationInterval(prev => ({
                ...prev,
                signals: signalInterval
            }));

            // Initialize signals to green
            const signals = svg.querySelectorAll('#traffic-signals circle');
            signals.forEach(signal => {
                signal.setAttribute('fill', '#00ff00');
                signal.setAttribute('stroke', '#00cc00');
                signal.setAttribute('r', '8');
            });

            // Modified traffic signal animation with independent timing
            signals.forEach(signal => {
                // Give each signal its own random offset between 0-12 seconds
                const initialDelay = Math.random() * 12000;
                
                // Set initial random state
                const initialState = Math.random() < 0.5;
                signal.setAttribute('fill', initialState ? '#00ff00' : '#ff0000');
                signal.setAttribute('stroke', initialState ? '#00cc00' : '#cc0000');
                signal.setAttribute('r', '8');
                
                // Create independent interval for each signal
                const signalInterval = setInterval(() => {
                    const currentColor = signal.getAttribute('fill');
                    const isRed = currentColor === '#ff0000';
                    
                    signal.setAttribute('fill', isRed ? '#00ff00' : '#ff0000');
                    signal.setAttribute('stroke', isRed ? '#00cc00' : '#cc0000');
                }, 12000);
    
                // Store interval ID on the signal element for cleanup
                signal._interval = signalInterval;
    
                // Initial delay for randomized start
                setTimeout(() => {
                    const randomState = Math.random() < 0.5;
                    signal.setAttribute('fill', randomState ? '#00ff00' : '#ff0000');
                    signal.setAttribute('stroke', randomState ? '#00cc00' : '#cc0000');
                }, initialDelay);
            });
    
            // Modify simulation interval storage to include array of signal intervals
            setSimulationInterval(prev => ({
                ...prev,
                spawn: spawnInterval,
                signals: Array.from(signals).map(signal => signal._interval)
            }));

            // Define timing constants at the start of the function
            const GREEN_LIGHT_TIME = 10000; // 10 seconds for green light
            const RED_LIGHT_TIME = 4000;    // 8 seconds for red light
            const SIGNAL_CYCLE_TIME = GREEN_LIGHT_TIME + RED_LIGHT_TIME; // Total cycle time

            // Modified traffic signal animation with adjusted timing
            signals.forEach(signal => {
                const initialDelay = Math.random() * SIGNAL_CYCLE_TIME;
                
                // Set initial random state
                const initialState = Math.random() < 0.5;
                signal.setAttribute('fill', initialState ? '#00ff00' : '#ff0000');
                signal.setAttribute('stroke', initialState ? '#00cc00' : '#cc0000');
                signal.setAttribute('r', '8');
                
                // Create independent interval for each signal with new timing
                const signalInterval = setInterval(() => {
                    // Switch to green
                    signal.setAttribute('fill', '#00ff00');
                    signal.setAttribute('stroke', '#00cc00');
                    
                    // Switch to red after GREEN_LIGHT_TIME
                    setTimeout(() => {
                        signal.setAttribute('fill', '#ff0000');
                        signal.setAttribute('stroke', '#cc0000');
                    }, GREEN_LIGHT_TIME);

                }, SIGNAL_CYCLE_TIME);

                signal._interval = signalInterval;
            });

        } catch (error) {
            console.error("Error starting simulation:", error);
            setIsSimulating(false);
        }
    };

    const stopSimulation = () => {
        try {
            if (simulationInterval) {
                // Clear spawn interval
                if (simulationInterval.spawn) {
                    clearInterval(simulationInterval.spawn);
                }

                // Clear and reset signals to original state
                const signalsGroup = document.querySelector('#traffic-signals');
                if (signalsGroup) {
                    const signals = signalsGroup.querySelectorAll('circle');
                    signals.forEach(signal => {
                        // Clear all timeouts and intervals
                        if (signal._interval) {
                            clearInterval(signal._interval);
                            delete signal._interval;
                        }
                        if (signal._timeouts) {
                            signal._timeouts.forEach(timeout => clearTimeout(timeout));
                            delete signal._timeouts;
                        }

                        // Reset to original appearance
                        signal.setAttribute('fill', '#f1c40f');    // Yellow color
                        signal.setAttribute('stroke', '#f39c12');   // Yellow stroke
                        signal.setAttribute('r', '6');             // Original size
                        signal.style.transition = 'none';
                        
                        // Remove all simulation attributes
                        signal.removeAttribute('data-state');
                        signal.removeAttribute('data-next-change');
                        signal.removeAttribute('data-cycle-time');
                        signal.removeAttribute('data-offset');
                    });
                }

                // Clear all remaining signal intervals
                if (simulationInterval.signals) {
                    if (Array.isArray(simulationInterval.signals)) {
                        simulationInterval.signals.forEach(interval => {
                            if (interval) clearInterval(interval);
                        });
                    } else if (typeof simulationInterval.signals === 'number') {
                        clearInterval(simulationInterval.signals);
                    }
                }

                // Remove vehicles
                const vehiclesGroup = document.querySelector('#vehicles');
                if (vehiclesGroup) {
                    // Clean up each vehicle's animations
                    const vehicles = vehiclesGroup.querySelectorAll('.vehicle');
                    vehicles.forEach(vehicle => {
                        if (vehicle._cleanup) {
                            vehicle._cleanup();
                        }
                        if (vehicle._animationFrame) {
                            cancelAnimationFrame(vehicle._animationFrame);
                        }
                        vehicle.remove();
                    });
                    
                    // Remove vehicles group entirely
                    vehiclesGroup.remove();
                }

                // Reset all simulation state
                setSimulationInterval(null);
                setIsSimulating(false);

                // Handle any remaining timeouts or intervals
                if (window._simulationTimeouts) {
                    window._simulationTimeouts.forEach(timeout => clearTimeout(timeout));
                    window._simulationTimeouts = [];
                }

                // Re-render the signals in their original state
                if (uploadedData && uploadedData.trafficSignals) {
                    const svg = document.querySelector('.map-svg');
                    if (svg) {
                        const signalsGroup = svg.querySelector('#traffic-signals');
                        if (signalsGroup) {
                            signalsGroup.innerHTML = '';
                            uploadedData.trafficSignals.forEach((signal, index) => {
                                const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                                circle.setAttribute('id', signal.id || `signal_${index + 1}`);
                                circle.setAttribute('cx', signal.x);
                                circle.setAttribute('cy', signal.y);
                                circle.setAttribute('r', '6');
                                circle.setAttribute('fill', '#f1c40f');
                                circle.setAttribute('stroke', '#f39c12');
                                circle.setAttribute('stroke-width', '2');
                                circle.setAttribute('class', 'traffic-signal');
                                signalsGroup.appendChild(circle);
                            });
                        }
                    }
                }

                toast.info('Simulation stopped');
            }
        } catch (error) {
            console.error("Error stopping simulation:", error);
            setSimulationInterval(null);
            setIsSimulating(false);
            toast.error("Error stopping simulation");
        }
    };

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (simulationInterval) {
                clearInterval(simulationInterval);
            }
        };
    }, [simulationInterval]);

    // Add missing function
    const createSignalsGroup = (svg) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute('id', 'traffic-signals');
        svg.appendChild(group);
        return group;
    };

    // Add this helper function to find intersection point between line segments
    const findIntersection = (x1, y1, x2, y2, x3, y3, x4, y4) => {
        const denominator = ((x2 - x1) * (y4 - y3)) - ((y2 - y1) * (x4 - x3));
        if (denominator === 0) return null;

        const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denominator;
        const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denominator;

        if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;

        const x = x1 + (ua * (x2 - x1));
        const y = y1 + (ua * (y2 - y1));

        return { x, y };
    };

    // Add this helper function to create intersection nodes group
    const createIntersectionNodesGroup = (svg) => {
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.setAttribute('id', 'intersection-nodes');
        svg.appendChild(group);
        return group;
    };

    return {
        selectedFile,
        uploadMessage,
        handleFileChange,
        handleFileUpload,
        uploadedData,
        mapsList,
        selectedMap,
        setSelectedMap,
        handleDisplayMap,
        handleDeleteMap,
        handleClearMap,
        isDrawingMode,
        handleAddRoadClick,
        handleMapClick,
        isRemovingMode,
        handleRemoveRoadClick,
        isSignalMode,
        handleAddSignalClick,
        unsavedChanges,
        selectedBaseModel,
        handleBaseModelChange,
        modelsList,
        isEditMode,
        handleEditModeClick,
        roadNetworks,
        vehicles,
        isSimulationRunning,
        isSimulating,
        toggleTrafficSimulation,
    };
};

export default useUploadMap;
