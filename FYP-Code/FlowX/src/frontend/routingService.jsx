import L from 'leaflet';
import 'leaflet-routing-machine';

class RoutingService {
    constructor() {
        this.routingControls = new Map(); // Store multiple routing controls
        this.routes = new Map();
    }

    initRouting(map) {
        this.map = map; // Store map reference
        return this;
    }

    createRoutingControl() {
        return L.Routing.control({
            waypoints: [],
            lineOptions: {
                styles: [
                    { color: '#3388ff', opacity: 0.8, weight: 4 }
                ],
                addWaypoints: false
            },
            showAlternatives: false,
            fitSelectedRoutes: false,
            show: false,
            routeWhileDragging: false
        }).addTo(this.map);
    }

    async calculateRoute(startLatLng, endLatLng) {
        return new Promise((resolve, reject) => {
            const routeId = `${Date.now()}-${Math.random()}`;
            const routingControl = this.createRoutingControl();
            
            this.routingControls.set(routeId, routingControl);
            
            routingControl.setWaypoints([
                L.latLng(startLatLng),
                L.latLng(endLatLng)
            ]);

            const routeFoundHandler = (e) => {
                const routes = e.routes;
                const route = routes[0];
                
                this.routes.set(routeId, {
                    coordinates: route.coordinates,
                    distance: route.summary.totalDistance,
                    time: route.summary.totalTime,
                    control: routingControl
                });

                routingControl.off('routesfound', routeFoundHandler);

                resolve({
                    routeId,
                    route: route
                });
            };

            const errorHandler = (e) => {
                routingControl.off('routingerror', errorHandler);
                reject(e.error);
            };

            routingControl.on('routesfound', routeFoundHandler);
            routingControl.on('routingerror', errorHandler);
        });
    }

    updateRouteStyle(routeId, style) {
        const route = this.routes.get(routeId);
        if (route && route.control) {
            route.control.setStyle({
                styles: [style]
            });
        }
    }

    removeRoute(routeId) {
        if (this.routes.has(routeId)) {
            const route = this.routes.get(routeId);
            if (route.control) {
                this.map.removeControl(route.control);
            }
            this.routes.delete(routeId);
            this.routingControls.delete(routeId);
        }
    }

    clearAllRoutes() {
        this.routes.forEach((route, routeId) => {
            this.removeRoute(routeId);
        });
        this.routes.clear();
        this.routingControls.clear();
    }

    getRouteDetails(routeId) {
        return this.routes.get(routeId);
    }
}

export default RoutingService;