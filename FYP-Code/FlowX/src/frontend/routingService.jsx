import L from 'leaflet';

class RoutingService {
    constructor() {
        this.routes = new Map();
        this.routePolylines = new Map();
    }

    initRouting(map) {
        this.map = map;
        return this;
    }

    async calculateRoute(startLatLng, endLatLng) {
        try {
            // Convert LatLng objects to arrays
            const startCoords = [startLatLng.lat, startLatLng.lng];
            const endCoords = [endLatLng.lat, endLatLng.lng];

            // Debug coordinate values
            console.log('Input coordinates:', { 
                start: startCoords, 
                end: endCoords 
            });

            // Validate coordinates are numbers
            const isValidCoord = coord => 
                Array.isArray(coord) && 
                coord.length === 2 && 
                !isNaN(coord[0]) && 
                !isNaN(coord[1]);

            if (!isValidCoord(startCoords) || !isValidCoord(endCoords)) {
                console.error('Invalid coordinates format:', { startCoords, endCoords });
                throw new Error('Invalid coordinates');
            }

            // Validate coordinate ranges for Singapore
            if (!this.isInSingaporeBounds(startCoords) || !this.isInSingaporeBounds(endCoords)) {
                console.error('Coordinates outside Singapore bounds');
                throw new Error('Coordinates outside Singapore bounds');
            }

            const response = await fetch(`${process.env.REACT_APP_API_URL}/route`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    origin: startCoords,
                    destination: endCoords
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Route calculation failed');
            }

            const routeData = await response.json();
            const routeId = `${Date.now()}-${Math.random()}`;

            // Create polyline from route coordinates
            const polyline = L.polyline(routeData.coordinates, {
                color: '#3388ff',
                weight: routeData.warning ? 6 : 4,  // Make short routes more visible
                opacity: 0.8
            }).addTo(this.map);

            // If it's a very short route, add a marker at the midpoint
            if (routeData.warning) {
                const coords = routeData.coordinates;
                const midpoint = [
                    (coords[0][0] + coords[1][0]) / 2,
                    (coords[0][1] + coords[1][1]) / 2
                ];
                
                L.circleMarker(midpoint, {
                    radius: 5,
                    color: '#3388ff',
                    fillColor: '#3388ff',
                    fillOpacity: 1
                }).addTo(this.map);

                // Zoom in closer for short routes
                this.map.setView(midpoint, 19);
            }

            // Store route information
            this.routes.set(routeId, {
                coordinates: routeData.coordinates,
                distance: routeData.distance,
                time: routeData.time,
                polyline: polyline,
                warning: routeData.warning
            });

            this.routePolylines.set(routeId, polyline);

            return {
                routeId,
                route: {
                    coordinates: routeData.coordinates,
                    summary: {
                        totalDistance: routeData.distance,
                        totalTime: routeData.time
                    }
                }
            };
        } catch (error) {
            console.error('Error calculating route:', error);
            throw error;
        }
    }

    isInSingaporeBounds(coord) {
        const [lat, lng] = coord;
        return lat >= 1.1 && lat <= 1.5 && lng >= 103.6 && lng <= 104.1;
    }

    updateRouteStyle(routeId, style) {
        const polyline = this.routePolylines.get(routeId);
        if (polyline) {
            polyline.setStyle(style);
        }
    }

    removeRoute(routeId) {
        const route = this.routes.get(routeId);
        if (route) {
            if (route.polyline) {
                this.map.removeLayer(route.polyline);
            }
            this.routes.delete(routeId);
            this.routePolylines.delete(routeId);
        }
    }

    clearAllRoutes() {
        this.routes.forEach((route, routeId) => {
            this.removeRoute(routeId);
        });
        this.routes.clear();
        this.routePolylines.clear();
    }

    getRouteDetails(routeId) {
        return this.routes.get(routeId);
    }
}

export default RoutingService;