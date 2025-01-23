import { useState, useEffect } from 'react';
import axios from 'axios';
import styles from '../css/uploadmap.module.css';

const useUploadMap = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');
    const [uploadedData, setUploadedData] = useState(null);
    const [mapsList, setMapsList] = useState([]);
    const [selectedMap, setSelectedMap] = useState('');
    const [trafficData, setTrafficData] = useState({});
    const [isTrafficVisible, setIsTrafficVisible] = useState(false);
    const API_URL = process.env.REACT_APP_API_URL;
    const MESSAGE_TIMEOUT = 5000; // 5 seconds
    const [isDrawingMode, setIsDrawingMode] = useState(false);
    const [isRemovingMode, setIsRemovingMode] = useState(false);
    const [drawingStart, setDrawingStart] = useState(null);
    const [tempRoad, setTempRoad] = useState(null);

    const showTimedMessage = (message, isError = false) => {
        setUploadMessage(message);
        setTimeout(() => {
            setUploadMessage('');
        }, MESSAGE_TIMEOUT);
    };

    

    const fetchMapsList = async () => {
        try {
            console.log("Fetching maps list...");  // Debug log
            const response = await axios.get(`${API_URL}/maps`, { withCredentials: true });
            console.log("Maps received:", response.data);  // Debug log
            setMapsList(response.data);
        } catch (error) {
            console.error("Error fetching maps:", error);
            setUploadMessage('Error fetching maps list.');
        }
    };

    useEffect(() => {
        // Check session and fetch maps list
        const initializeData = async () => {
            try {
                const sessionResponse = await axios.get(`${API_URL}/session`, { withCredentials: true });
                if (!sessionResponse.data.username) {
                    setUploadMessage('You must be logged in to upload files.');
                    return;
                }
                await fetchMapsList();
            } catch (error) {
                console.error("Error during initialization:", error);
                setUploadMessage('Error fetching session data. Please log in.');
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
            showTimedMessage('Please select a valid XML file.', true);
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
            showTimedMessage('Please select a file to upload.', true);
            return;
        }

        try {
            // Create form data with original XML file (no processing needed)
            const formData = new FormData();
            formData.append('file', selectedFile);

            try {
                const response = await axios.post(`${API_URL}/upload`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    },
                    withCredentials: true
                });
                
                console.log('Upload response:', response.data);
                showTimedMessage(response.data.message);
                setSelectedFile(null);
                fetchMapsList();
            } catch (error) {
                showTimedMessage('Error uploading file: ' + (error.response?.data?.message || error.message), true);
            }
        } catch (error) {
            showTimedMessage('Error processing file: ' + error.message, true);
        }
    };

    const fetchUploadedData = async (fileId) => {
        try {
            const response = await axios.get(`${API_URL}/files/${fileId}`, { withCredentials: true });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.data.data, 'text/xml');
            const svgElement = xmlDoc.querySelector('svg');
            
            if (svgElement) {
                setUploadedData({
                    svgContent: svgElement.outerHTML
                });
            } else {
                setUploadMessage('No SVG content found in the uploaded file.');
            }
        } catch (error) {
            console.error("Error fetching uploaded data:", error);
            setUploadMessage('Error fetching uploaded data.');
        }
    };

    const updateMapColors = (roadData) => {
        if (!uploadedData) {
            console.log('No uploaded data available');
            return;
        }
        
        const svgContainer = document.querySelector('.svgContainer svg');
        if (!svgContainer) {
            console.log('No SVG container found');
            return;
        }

        // First, reset all roads to default color
        const allRoads = svgContainer.querySelectorAll('#roads path');
        console.log('Found roads:', allRoads.length);
        allRoads.forEach(road => {
            road.style.stroke = '#2c3e50';
        });

        if (!isTrafficVisible) {
            console.log('Traffic visibility is off');
            return;
        }

        // Log the road mapping and traffic data for debugging
        console.log('Road Mapping:', uploadedData.roadMapping);
        console.log('Traffic Data:', roadData);

        roadData.forEach((data) => {
            // Get the original route ID from the mapping
            const mapping = uploadedData.roadMapping[data.road_id];
            if (mapping) {
                const roadElement = svgContainer.querySelector(`#roads #${mapping.route_id}`);
                if (roadElement) {
                    console.log(`Updating road ${mapping.route_id} with intensity ${data.intensity}`);
                    switch (data.intensity) {
                        case 'low':
                            roadElement.style.stroke = '#2ecc71';
                            break;
                        case 'medium':
                            roadElement.style.stroke = '#f1c40f';
                            break;
                        case 'high':
                            roadElement.style.stroke = '#e74c3c';
                            break;
                        default:
                            roadElement.style.stroke = '#2c3e50';
                            break;
                    }
                } else {
                    console.log(`Road element not found for ID: ${mapping.route_id}`);
                }
            } else {
                console.log(`No mapping found for road_id: ${data.road_id}`);
            }
        });
    };

    const fetchTrafficData = async () => {
        try {
            if (!selectedMap) {
                console.log('No map selected');
                return;
            }

            const response = await axios.get(`${API_URL}/traffic/data?map_id=${selectedMap}`, { 
                withCredentials: true 
            });
            console.log('Fetched traffic data:', response.data);
            setTrafficData(response.data);
            updateMapColors(response.data);
        } catch (error) {
            console.error('Error fetching traffic data:', error);
        }
    };

    useEffect(() => {
        if (isTrafficVisible && uploadedData) {
            console.log('Traffic is visible and map is loaded, fetching data...');
            fetchTrafficData();
            const interval = setInterval(fetchTrafficData, 30000); // Update every 30 seconds
            return () => clearInterval(interval);
        }
    }, [isTrafficVisible, uploadedData]);

    const handleToggleTraffic = () => {
        setIsTrafficVisible(prev => {
            const newValue = !prev;
            if (newValue) {
                console.log('Fetching traffic data...');
                fetchTrafficData();
            } else {
                console.log('Resetting road colors...');
                const svgContainer = document.querySelector('.svgContainer svg');
                if (svgContainer) {
                    const allRoads = svgContainer.querySelectorAll('path');
                    allRoads.forEach(road => {
                        road.style.stroke = '#2c3e50';
                    });
                }
            }
            return newValue;
        });
    };

    const handleDisplayMap = async () => {
        if (!selectedMap) return;

        try {
            const response = await axios.get(`${API_URL}/files/${selectedMap}`, { withCredentials: true });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.data.data, 'text/xml');
            const svgElement = xmlDoc.querySelector('svg');
            
            // Get the road mapping from response
            const roadMapping = response.data.route_mapping || {};
            console.log('Road Mapping:', roadMapping);

            if (svgElement) {
                setUploadedData({
                    svgContent: svgElement.outerHTML,
                    roadCount: Object.keys(roadMapping).length,
                    roadMapping: roadMapping  // Store the mapping
                });

                if (isTrafficVisible) {
                    // Wait a bit for the SVG to be rendered
                    setTimeout(() => {
                        fetchTrafficData();
                    }, 100);
                }
                showTimedMessage('Map displayed successfully.');
            } else {
                showTimedMessage('No SVG content found in the selected file.', true);
            }
        } catch (error) {
            console.error("Error displaying map:", error);
            showTimedMessage('Error displaying map.', true);
        }
    };

    const handleDeleteMap = async () => {
        if (!selectedMap) return;

        try {
            await axios.delete(`${API_URL}/files/${selectedMap}`, { withCredentials: true });
            setSelectedMap('');
            setUploadedData(null);
            showTimedMessage('Map deleted successfully.');
            await fetchMapsList();
        } catch (error) {
            console.error("Error deleting map:", error);
            showTimedMessage('Error deleting map.', true);
        }
    };

    const handleClearMap = () => {
        setUploadedData(null);
    };

    const handleAddRoadClick = () => {
        console.log('Current drawing mode:', isDrawingMode); // Debug log
        setIsDrawingMode(prev => {
            const newValue = !prev;
            if (newValue) {
                setIsRemovingMode(false); // Disable removing mode when drawing mode is enabled
            }
            console.log('Setting drawing mode to:', newValue); // Debug log
            return newValue;
        });
        
        if (isDrawingMode) {
            setDrawingStart(null);
            setTempRoad(null);
        }
    };

    const handleRemoveRoadClick = () => {
        console.log('Current removing mode:', isRemovingMode);
        setIsRemovingMode(prev => {
            const newValue = !prev;
            if (newValue) {
                setIsDrawingMode(false); // Disable drawing mode when removing mode is enabled
            }
            console.log('Setting removing mode to:', newValue);
            return newValue;
        });
        
        if (isRemovingMode) {
            setDrawingStart(null);
            setTempRoad(null);
        }
    };

    const handleMapClick = (e) => {
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
                showTimedMessage('Road removed successfully');
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
            if (roadGroup) {
                const newRoad = document.createElementNS("http://www.w3.org/2000/svg", "path");
                newRoad.setAttribute("d", `M${drawingStart.x},${drawingStart.y} L${scaledX},${scaledY}`);
                newRoad.setAttribute("stroke", "#2c3e50");
                newRoad.setAttribute("stroke-width", "45");
                newRoad.setAttribute("stroke-linecap", "round");
                newRoad.setAttribute("fill", "none");
                
                const existingRoads = roadGroup.querySelectorAll('path');
                const newId = `road_${existingRoads.length + 1}`;
                newRoad.setAttribute("id", newId);
                
                roadGroup.appendChild(newRoad);
    
                // Update road count
                if (uploadedData) {
                    setUploadedData(prev => ({
                        ...prev,
                        roadCount: (prev.roadCount || 0) + 1
                    }));
                }
            }
    
            // Reset drawing state
            setDrawingStart(null);
            setTempRoad(null);
        }
    };

    const handleMapMouseMove = (e) => {
        if (!isDrawingMode || !drawingStart) return;
    
        const findSVGElement = (element) => {
            while (element && element.tagName !== 'svg') {
                element = element.parentElement;
            }
            return element;
        };
    
        const svg = findSVGElement(e.target);
        if (!svg) return;
    
        const svgRect = svg.getBoundingClientRect();
        const x = e.clientX - svgRect.left;
        const y = e.clientY - svgRect.top;
    
        let scaledX = x;
        let scaledY = y;
        
        let viewBox = svg.getAttribute('viewBox');
        if (viewBox) {
            viewBox = viewBox.split(' ').map(Number);
            const scaleX = viewBox[2] / svgRect.width;
            const scaleY = viewBox[3] / svgRect.height;
            scaledX = x * scaleX;
            scaledY = y * scaleY;
        }
    
        setTempRoad({
            start: drawingStart,
            end: { x: scaledX, y: scaledY }
        });
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
        isTrafficVisible,
        handleToggleTraffic,
        isDrawingMode,
        handleAddRoadClick,
        handleMapClick,
        handleMapMouseMove,
        tempRoad,
        isRemovingMode,
        handleRemoveRoadClick,
    };
};

export default useUploadMap;
