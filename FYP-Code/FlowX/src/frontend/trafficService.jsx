// trafficService.jsx
const API_URL = process.env.REACT_APP_API_URL;

class TrafficService {
    async getTrafficBetweenNodes(startLat, startLng, endLat, endLng) {
        try {
            // Get traffic flow data along the route
            const trafficData = await this.fetchTrafficFlow(startLat, startLng, endLat, endLng);
            
            // Get incidents along the route
            const incidentData = await this.fetchTrafficIncidents(startLat, startLng, endLat, endLng);

            return {
                flow: trafficData,
                incidents: incidentData
            };
        } catch (error) {
            console.error('Error fetching traffic data:', error);
            throw error;
        }
    }

    async fetchTrafficFlow(startLat, startLng, endLat, endLng) {
        try {
            // Calculate midpoint between start and end
            const midLat = (startLat + endLat) / 2;
            const midLng = (startLng + endLng) / 2;
            
            // Calculate rough distance for radius
            const distance = this.calculateDistance(startLat, startLng, endLat, endLng);
            const radius = Math.ceil(distance * 1000); // Convert to meters
            
            const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json` +
                       `?key=${API_URL}` +
                       `&point=${midLat},${midLng}` +
                       `&unit=KMPH` +
                       `&thickness=10` +
                       `&radius=${radius}` +
                       `&sectionType=points`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch traffic flow data');
            }

            const data = await response.json();
            
            return {
                currentSpeed: data.flowSegmentData?.currentSpeed || 0,
                freeFlowSpeed: data.flowSegmentData?.freeFlowSpeed || 0,
                currentTravelTime: data.flowSegmentData?.currentTravelTime || 0,
                freeFlowTravelTime: data.flowSegmentData?.freeFlowTravelTime || 0,
                confidence: data.flowSegmentData?.confidence || 0,
                roadClosure: data.flowSegmentData?.roadClosure || false,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error fetching traffic flow:', error);
            throw error;
        }
    }

    async fetchTrafficIncidents(startLat, startLng, endLat, endLng) {
        try {
            const boundingBox = this.calculateBoundingBox(startLat, startLng, endLat, endLng);
            
            const url = `https://api.tomtom.com/traffic/services/4/incidentDetails/s3/${boundingBox.join(',')}/10/-1/json` +
                       `?key=${API_URL}` +
                       `&language=en-GB` +
                       `&categoryFilter=0,1,2,3,4,5,6,7,8,9,10,11,14`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error('Failed to fetch traffic incidents');
            }

            const data = await response.json();
            
            return data.incidents?.map(incident => ({
                id: incident.id,
                type: incident.type,
                severity: incident.severity,
                description: incident.description,
                startTime: incident.startTime,
                endTime: incident.endTime,
                from: incident.from,
                to: incident.to,
                length: incident.length,
                delay: incident.delay,
                location: {
                    lat: incident.point?.lat,
                    lng: incident.point?.lng
                }
            })) || [];
        } catch (error) {
            console.error('Error fetching traffic incidents:', error);
            throw error;
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
    }

    calculateBoundingBox(startLat, startLng, endLat, endLng) {
        const padding = 0.01; // About 1km padding
        return [
            Math.min(startLat, endLat) - padding,
            Math.min(startLng, endLng) - padding,
            Math.max(startLat, endLat) + padding,
            Math.max(startLng, endLng) + padding
        ];
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    calculateCongestion(currentSpeed, freeFlowSpeed) {
        if (freeFlowSpeed === 0) return 0;
        const congestion = Math.max(0, Math.min(100, 
            (1 - (currentSpeed / freeFlowSpeed)) * 100
        ));
        return Math.round(congestion * 10) / 10; // Round to 1 decimal place
    }

    getTrafficStatus(congestion) {
        if (congestion < 30) return 'Low Traffic';
        if (congestion < 60) return 'Moderate Traffic';
        return 'Heavy Traffic';
    }

    getTrafficColor(congestion) {
        if (congestion <= 30) return '#4CAF50';  // Green for low traffic
        if (congestion <= 60) return '#FFA000';  // Orange for moderate traffic
        return '#F44336';  // Red for heavy traffic
    }

    getRouteStyle(congestion) {
        return {
            color: this.getTrafficColor(congestion),
            opacity: 0.8,
            weight: 6
        };
    }
}

export default TrafficService;