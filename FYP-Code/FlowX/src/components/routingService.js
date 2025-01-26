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
            const response = await fetch('/api/route', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    origin: [startLatLng[0], startLatLng[1]],
                    destination: [endLatLng[0], endLatLng[1]]
                })
            });

            if (!response.ok) {
                throw new Error('Route calculation failed');
            }

            const routeData = await response.json();
            const routeId = `${Date.now()}-${Math.random()}`;

            // Create polyline from route coordinates
            const polyline = L.polyline(routeData.coordinates, {
                color: '#3388ff',
                weight: 4,
                opacity: 0.8
            }).addTo(this.map);

            // Store route information
            this.routes.set(routeId, {
                coordinates: routeData.coordinates,
                distance: routeData.distance,
                time: routeData.time,
                polyline: polyline
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
