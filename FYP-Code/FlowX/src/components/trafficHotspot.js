export class TrafficHotspotService {
    constructor(trafficService) {
        this.trafficService = trafficService;
    }

    async fetchJunctionTraffic(junctions) {  // Modified to accept junctions as parameter
        try {
            const trafficPromises = junctions.map(async junction => {
                const data = await this.trafficService.getTrafficBetweenNodes(
                    junction.lat - 0.001,
                    junction.lng - 0.001,
                    junction.lat + 0.001,
                    junction.lng + 0.001
                );

                const congestion = this.trafficService.calculateCongestion(
                    data.flow.currentSpeed,
                    data.flow.freeFlowSpeed
                );

                return {
                    ...junction,
                    congestion,
                    currentSpeed: data.flow.currentSpeed,
                    incidents: data.incidents
                };
            });

            const trafficData = await Promise.all(trafficPromises);
            return trafficData.sort((a, b) => b.congestion - a.congestion);
        } catch (error) {
            console.error('Error fetching junction traffic:', error);
            throw error;
        }
    }

    getStatusColor(congestion) {
        if (congestion < 30) return '#4CAF50';
        if (congestion < 60) return '#FFA000';
        return '#F44336';
    }
}
