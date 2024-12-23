import { useState, useEffect, useCallback } from 'react';

export const useFileUpload = () => {
    const [loading, setLoading] = useState(false);
    const [mapData, setMapData] = useState(null);
    const [nodes, setNodes] = useState([]);
    const [links, setLinks] = useState([]);

    const handleFileUpload = async (event) => {
        event.preventDefault();
        const formData = new FormData(event.target);
        setLoading(true);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (response.ok) {
                setMapData(data.map);
                setNodes(data.nodes);
                setLinks(data.links);
                alert('File uploaded successfully!');
            } else {
                alert(data.error || 'Upload failed');
            }
        } catch (error) {
            console.error('Error uploading file:', error);
            alert('An error occurred during file upload. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return { loading, mapData, nodes, links, handleFileUpload };
};

export const useClearData = () => {
    const [loading, setLoading] = useState(false);

    const handleClearButton = async () => {
        if (window.confirm('Are you sure? This action cannot be undone.')) {
            setLoading(true);
            try {
                const response = await fetch('/clear', { method: 'POST' });
                if (response.ok) {
                    alert('All data cleared successfully');
                } else {
                    alert('Failed to clear data');
                }
            } catch (error) {
                console.error('Error clearing data:', error);
                alert('An error occurred while clearing data. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    };

    return { loading, handleClearButton };
};

export const useNodePlacement = (nodes, setNodes) => {
    const [isPlacementMode, setIsPlacementMode] = useState(false);
    const [tempNodePosition, setTempNodePosition] = useState(null);
    const [nodeName, setNodeName] = useState('');

    const toggleNodePlacementMode = () => {
        setIsPlacementMode(!isPlacementMode);
    };

    const handleNodePlacement = (e) => {
        if (!isPlacementMode) return;
        const rect = e.target.getBoundingClientRect();
        setTempNodePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
    };

    const saveNode = () => {
        if (!nodeName || !tempNodePosition) {
            alert('Please enter a valid node name.');
            return;
        }

        const newNode = {
            id: String(Date.now()), // Temporary ID
            name: nodeName,
            x: tempNodePosition.x,
            y: tempNodePosition.y,
        };

        setNodes([...nodes, newNode]);
        setNodeName('');
        setTempNodePosition(null);
    };

    const cancelNodePlacement = () => {
        setNodeName('');
        setTempNodePosition(null);
    };

    return {
        isPlacementMode,
        tempNodePosition,
        nodeName,
        toggleNodePlacementMode,
        handleNodePlacement,
        saveNode,
        cancelNodePlacement,
        setNodeName,
    };
};

export const updateMap = (mapData, nodesData) => {
    const svgContainer = document.getElementById('svgContainer');
    const nodeOverlay = document.getElementById('nodeOverlay');
    const mapPlaceholder = document.getElementById('mapPlaceholder');

    // Hide placeholder
    mapPlaceholder.style.display = 'none';

    // Set SVG content
    svgContainer.innerHTML = mapData.svg;
    nodeOverlay.innerHTML = '';

    // Add nodes as overlays
    nodesData.forEach(node => {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'node';
        nodeElement.style.left = `${node.x}px`;
        nodeElement.style.top = `${node.y}px`;
        nodeElement.setAttribute('data-node-id', node.id);

        const label = document.createElement('div');
        label.className = 'node-label';
        label.textContent = node.name;

        nodeElement.appendChild(label);
        nodeOverlay.appendChild(nodeElement);
    });
};

export const updateNodeSelects = (nodesData) => {
    const selects = ['node1', 'node2', 'startNode', 'endNode'];
    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        select.innerHTML = '<option value="">Select node</option>';
        nodesData.forEach(node => {
            const option = document.createElement('option');
            option.value = node.id;
            option.textContent = node.name;
            select.appendChild(option);
        });
    });
};

export const refreshLinks = () => {
    fetch('/links')
        .then(response => response.json())
        .then(links => {
            const tbody = document.getElementById('linksTable');
            tbody.innerHTML = links.length === 0 ? 
                '<tr><td colspan="4" class="px-4 py-2 text-center text-gray-500">No links created yet</td></tr>' : 
                links.map(link => `
                    <tr>
                        <td class="border px-4 py-2">${link.node1_name}</td>
                        <td class="border px-4 py-2">${link.node2_name}</td>
                        <td class="border px-4 py-2 text-right">${link.distance} km</td>
                        <td class="border px-4 py-2 text-center">
                            <button onclick="deleteLink('${link.node1}', '${link.node2}')" class="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">Delete</button>
                        </td>
                    </tr>
                `).join('');
        })
        .catch(error => console.error('Error refreshing links:', error));
};

export const useSimulation = (nodes) => {
    const [simulationResults, setSimulationResults] = useState(null);

    const runSimulation = async (data) => {
        try {
            const response = await fetch('/simulate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const results = await response.json();

            if (response.ok) {
                setSimulationResults(results);
                // Clear any existing animations
                const existingCars = document.querySelectorAll('.car');
                existingCars.forEach(car => car.remove());

                // Start the traffic animation along the existing link
                const startNode = nodes.find(n => n.id === data.start_node);
                const endNode = nodes.find(n => n.id === data.end_node);

                if (startNode && endNode) {
                    animateTraffic([startNode, endNode], data.vehicles, data.speed);
                }
            } else {
                alert(results.error || 'Simulation failed');
            }
        } catch (error) {
            console.error('Error running simulation:', error);
            alert('Error running simulation');
        }
    };

    return { simulationResults, runSimulation };
};

const animateTraffic = (path, vehicles, speed) => {
    const nodeOverlay = document.getElementById('nodeOverlay');
    const carInterval = (3600 / vehicles) * 1000; // Convert vehicles per hour to milliseconds between cars
    let carCount = 0;

    const start = path[0];
    const end = path[1];
    const distance = Math.sqrt(
        Math.pow(end.x - start.x, 2) + 
        Math.pow(end.y - start.y, 2)
    );

    // Calculate travel time based on speed and distance
    const travelTime = (distance / (speed * 100)) * 3600 * 1000; // Convert to milliseconds

    // Create car element
    const spawnCar = () => {
        if (carCount >= vehicles) {
            clearInterval(intervalId);
            return;
        }

        const car = document.createElement('div');
        car.className = 'car';
        car.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background-color: #FF0000;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            transition: all ${travelTime}ms linear;
            z-index: 20;
            left: ${start.x}px;
            top: ${start.y}px;
        `;

        nodeOverlay.appendChild(car);

        // Start animation after a small delay
        requestAnimationFrame(() => {
            car.style.left = `${end.x}px`;
            car.style.top = `${end.y}px`;
        });

        // Remove car after animation completes
        setTimeout(() => {
            car.remove();
        }, travelTime + 100);

        carCount++;
    };

    // Spawn first car immediately
    spawnCar();

    // Spawn remaining cars at intervals
    const intervalId = setInterval(spawnCar, carInterval);
};

export const visualizeCongestion = (results, nodes) => {
    // Remove previous congestion visualization
    const existingCongestion = document.querySelectorAll('.congestion-indicator');
    existingCongestion.forEach(el => el.remove());

    // Add congestion indicators
    const nodeOverlay = document.getElementById('nodeOverlay');

    Object.entries(results.congestion).forEach(([nodeId, data]) => {
        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            const indicator = document.createElement('div');
            indicator.className = 'congestion-indicator';
            indicator.style.position = 'absolute';
            indicator.style.left = `${node.x}px`;
            indicator.style.top = `${node.y}px`;
            indicator.style.width = '20px';
            indicator.style.height = '20px';
            indicator.style.borderRadius = '50%';
            indicator.style.transform = 'translate(-50%, -50%)';

            // Color based on congestion level
            const red = Math.floor(255 * data.level);
            const green = Math.floor(255 * (1 - data.level));
            indicator.style.backgroundColor = `rgba(${red}, ${green}, 0, 0.6)`;

            // Add tooltip
            indicator.title = `Congestion: ${Math.round(data.level * 100)}%`;

            nodeOverlay.appendChild(indicator);
        }
    });

    // Highlight path
    results.path.forEach((nodeId, index) => {
        if (index < results.path.length - 1) {
            const currentNode = nodes.find(n => n.id === nodeId);
            const nextNode = nodes.find(n => n.id === results.path[index + 1]);

            if (currentNode && nextNode) {
                const pathLine = document.createElement('div');
                pathLine.className = 'congestion-indicator path-line';
                pathLine.style.position = 'absolute';
                pathLine.style.height = '4px';
                pathLine.style.backgroundColor = 'rgba(0, 255, 0, 0.5)';
                pathLine.style.transformOrigin = '0 0';

                const dx = nextNode.x - currentNode.x;
                const dy = nextNode.y - currentNode.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;

                pathLine.style.width = `${length}px`;
                pathLine.style.left = `${currentNode.x}px`;
                pathLine.style.top = `${currentNode.y}px`;
                pathLine.style.transform = `rotate(${angle}deg)`;

                nodeOverlay.appendChild(pathLine);
            }
        }
    });
};


export const updateSimulationResults = (results) => {
    const resultsDiv = document.getElementById('simulationResults');
    resultsDiv.classList.remove('hidden');

    // Update metrics
    document.getElementById('totalDistance').textContent = 
        `${results.total_distance.toFixed(2)} km`;
    document.getElementById('timePerVehicle').textContent = 
        `${results.time_per_vehicle.toFixed(2)} minutes`;
    document.getElementById('vehiclesPerHour').textContent = 
        `${Math.round(results.vehicles_per_hour)} vehicles/hour`;

    // Update congestion list
    const congestionList = document.getElementById('congestionList');
    congestionList.innerHTML = '';

    Object.entries(results.congestion)
        .sort((a, b) => b[1].level - a[1].level)
        .forEach(([nodeId, data]) => {
            const div = document.createElement('div');
            div.className = 'p-2 border rounded';
            const level = Math.round(data.level * 100);
            div.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-semibold">${data.name}</span>
                    <span class="px-2 py-1 rounded text-white text-sm" 
                          style="background-color: ${level > 66 ? '#ef4444' : level > 33 ? '#f59e0b' : '#22c55e'}">
                        ${level}% Congested
                    </span>
                </div>
                <div class="text-sm text-gray-600">
                    ${Math.round(data.vehicles_per_hour)} vehicles/hour | 
                    ${data.connecting_roads} connecting roads
                </div>
            `;
            congestionList.appendChild(div);
        });
};

export const useZoomAndPan = () => {
    const [scale, setScale] = useState(1);
    const [translateX, setTranslateX] = useState(0);
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startY, setStartY] = useState(0);

    const updateTransform = useCallback(() => {
        const transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        const svgContainer = document.getElementById('svgContainer');
        const nodeOverlay = document.getElementById('nodeOverlay');
        if (svgContainer) svgContainer.style.transform = transform;
        if (nodeOverlay) nodeOverlay.style.transform = transform;
    }, [translateX, translateY, scale]);

    const resetView = () => {
        setScale(1);
        setTranslateX(0);
        setTranslateY(0);
    };

    useEffect(() => {
        const mapContainer = document.getElementById('mapContainer');

        const handleWheel = (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? 0.9 : 1.1;
                setScale((prevScale) => Math.min(Math.max(0.5, prevScale * delta), 3));
            }
        };

        const handleMouseDown = (e) => {
            if (e.target === mapContainer || e.target.tagName === 'svg') {
                setIsDragging(true);
                setStartX(e.clientX - translateX);
                setStartY(e.clientY - translateY);
                mapContainer.style.cursor = 'grabbing';
            }
        };

        const handleMouseMove = (e) => {
            if (isDragging) {
                setTranslateX(e.clientX - startX);
                setTranslateY(e.clientY - startY);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            mapContainer.style.cursor = 'default';
        };

        const handleTouchStart = (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                setStartX(touch.clientX - translateX);
                setStartY(touch.clientY - translateY);
            }
        };

        const handleTouchMove = (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                setTranslateX(touch.clientX - startX);
                setTranslateY(touch.clientY - startY);
            }
        };

        const handleTouchEnd = () => {
            // Reset any touch-specific state if needed
        };

        mapContainer.addEventListener('wheel', handleWheel);
        mapContainer.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        mapContainer.addEventListener('touchstart', handleTouchStart);
        mapContainer.addEventListener('touchmove', handleTouchMove);
        mapContainer.addEventListener('touchend', handleTouchEnd);

        return () => {
            mapContainer.removeEventListener('wheel', handleWheel);
            mapContainer.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            mapContainer.removeEventListener('touchstart', handleTouchStart);
            mapContainer.removeEventListener('touchmove', handleTouchMove);
            mapContainer.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isDragging, startX, startY, translateX, translateY]);

    useEffect(() => {
        updateTransform();
    }, [updateTransform]);

    return {
        scale,
        translateX,
        translateY,
        setScale,
        setTranslateX,
        setTranslateY,
        resetView,
    };
};

export const useLinkManagement = (nodes, setLinks) => {
    const createLink = async (node1Id, node2Id) => {
        try {
            const response = await fetch('/links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ node1: node1Id, node2: node2Id })
            });

            const data = await response.json();

            if (response.ok) {
                refreshLinks();
            } else {
                alert(data.error || 'Failed to create link');
            }
        } catch (error) {
            console.error('Error creating link:', error);
            alert('Error creating link');
        }
    };

    const deleteLink = async (node1Id, node2Id) => {
        if (!window.confirm('Are you sure you want to delete this link?')) {
            return;
        }

        try {
            const response = await fetch(`/links/${node1Id}/${node2Id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                refreshLinks();
            } else {
                alert('Failed to delete link');
            }
        } catch (error) {
            console.error('Error deleting link:', error);
            alert('Error deleting link');
        }
    };

    return { createLink, deleteLink };
};

export const useNodeDisplay = (nodes, setNodes) => {
    const updateNodeDisplay = () => {
        const nodeOverlay = document.getElementById('nodeOverlay');
        nodeOverlay.innerHTML = '';

        nodes.forEach(node => {
            const nodeElement = document.createElement('div');
            nodeElement.className = 'node';
            nodeElement.style.left = `${node.x}px`;
            nodeElement.style.top = `${node.y}px`;
            nodeElement.setAttribute('data-node-id', node.id);

            const label = document.createElement('div');
            label.className = 'node-label';
            label.textContent = node.name;

            nodeElement.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                if (window.confirm(`Delete node "${node.name}"?`)) {
                    deleteNode(node.id);
                }
            });

            nodeElement.appendChild(label);
            nodeOverlay.appendChild(nodeElement);
        });

        updateNodeSelects(nodes);
    };

    const deleteNode = async (nodeId) => {
        try {
            const response = await fetch(`/nodes/${nodeId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                setNodes(nodes.filter(n => n.id !== nodeId));
                updateNodeDisplay();
            } else {
                alert('Failed to delete node');
            }
        } catch (error) {
            console.error('Error deleting node:', error);
            alert('Error deleting node');
        }
    };

    return { updateNodeDisplay, deleteNode };
};

export const useInitialDataLoad = (setNodes, setMapData) => {
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const response = await fetch('/nodes');
                const data = await response.json();

                if (response.ok && data.nodes.length > 0) {
                    setNodes(data.nodes);
                    setMapData(data.map);
                    updateMap(data.map, data.nodes);
                    updateNodeSelects(data.nodes);
                    refreshLinks();
                }
            } catch (error) {
                console.error('Error loading initial data:', error);
            }
        };

        loadInitialData();
    }, [setNodes, setMapData]);
};

export const generatePathData = (start, end) => {
    const ROADS = {
        horizontal: 400,
        verticals: [150, 500, 850]
    };

    // Check if points are on the same road first
    if (Math.abs(start.y - ROADS.horizontal) < 5 && Math.abs(end.y - ROADS.horizontal) < 5) {
        // Direct horizontal path
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    // Check if points are on same vertical
    const sameVertical = ROADS.verticals.find(v => 
        Math.abs(start.x - v) < 5 && Math.abs(end.x - v) < 5
    );
    if (sameVertical) {
        // Direct vertical path
        return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    }

    // Normal path routing through road network
    let pathData = `M ${start.x} ${start.y}`;
    
    // Get nearest vertical roads
    const startVert = ROADS.verticals.reduce((nearest, current) => 
        Math.abs(current - start.x) < Math.abs(nearest - start.x) ? current : nearest
    );
    
    const endVert = ROADS.verticals.reduce((nearest, current) => 
        Math.abs(current - end.x) < Math.abs(nearest - end.x) ? current : nearest
    );

    // Move to horizontal road if needed
    if (Math.abs(start.y - ROADS.horizontal) > 5) {
        pathData += ` L ${start.x} ${ROADS.horizontal}`;
    }
    
    // Move to nearest vertical if needed
    if (Math.abs(start.x - startVert) > 5) {
        pathData += ` L ${startVert} ${ROADS.horizontal}`;
    }
    
    // Move along horizontal road to end's vertical
    pathData += ` L ${endVert} ${ROADS.horizontal}`;
    
    // Move to end point
    if (Math.abs(end.y - ROADS.horizontal) > 5) {
        pathData += ` L ${endVert} ${end.y}`;
    }
    pathData += ` L ${end.x} ${end.y}`;

    return pathData;
};

export const getMidpoint = (start, end) => {
    const ROADS = {
        horizontal: 400,
        verticals: [150, 500, 850]
    };
    
    // Find the vertical roads being used
    const startVert = ROADS.verticals.reduce((nearest, current) => 
        Math.abs(current - start.x) < Math.abs(nearest - start.x) ? current : nearest
    );
    
    const endVert = ROADS.verticals.reduce((nearest, current) => 
        Math.abs(current - end.x) < Math.abs(nearest - end.x) ? current : nearest
    );
    
    // Put label in middle of horizontal segment
    return {
        x: (startVert + endVert) / 2,
        y: ROADS.horizontal
    };
};

export const showLoading = () => {
    const mapContainer = document.getElementById('mapContainer');
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.innerHTML = '<div class="text-xl font-semibold">Loading...</div>';
    mapContainer.appendChild(loading);
};

export const hideLoading = () => {
    const mapContainer = document.getElementById('mapContainer');
    const loading = mapContainer.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
};

export const handleError = (error, context) => {
    console.error(`Error ${context}:`, error);
    alert(`An error occurred while ${context}. Please try again.`);
    hideLoading();
};


