import { useEffect, useRef } from 'react';
import L from 'leaflet';

const VehicleMarker = ({ map, coordinates, currentSpeed, color, initialOffset = 0, startDelay = 0 }) => {
    const markerRef = useRef(null);
    const animationFrameRef = useRef(null);
    const progressRef = useRef(-1); // Start before route
    const lastUpdateRef = useRef(Date.now());
    const startTimeRef = useRef(null);

    useEffect(() => {
        if (!map || !coordinates || coordinates.length < 2) return;

        // Create vehicle icon with improved visibility
        const vehicleIcon = L.divIcon({
            html: `
                <div style="
                    width: 10px;
                    height: 10px;
                    background-color: ${color};
                    border-radius: 50%;
                    border: 2px solid white;
                    box-shadow: 0 0 4px rgba(0,0,0,0.4);
                    position: relative;
                    z-index: ${Math.floor(Math.random() * 1000)}; /* Random z-index to prevent stacking */
                ">
                </div>
            `,
            className: 'vehicle-marker',
            iconSize: [14, 14],  // Slightly larger than the div
            iconAnchor: [7, 7]   // Center of the icon
        });

        // Create marker if it doesn't exist, with initial offset applied
        if (!markerRef.current) {
            markerRef.current = L.marker(coordinates[0], { icon: vehicleIcon }).addTo(map);
            progressRef.current = initialOffset;
            startTimeRef.current = Date.now();
        }

        const animate = () => {
            const now = Date.now();
            
            // Wait for start delay
            if (now - startTimeRef.current < startDelay) {
                animationFrameRef.current = requestAnimationFrame(animate);
                return;
            }

            const deltaTime = (now - lastUpdateRef.current) / 1000;
            lastUpdateRef.current = now;

            // Only start moving after delay
            if (progressRef.current === -1) {
                progressRef.current = 0;
            }

            // Calculate speed and update position
            const baseSpeed = Math.max(5, currentSpeed || 35);
            const speedFactor = 0.05;
            const speedMPS = (baseSpeed / 3.6) * speedFactor;
            
            progressRef.current = (progressRef.current + (speedMPS * deltaTime)) % 100;
            
            // Calculate current position
            const totalLength = coordinates.reduce((acc, _, idx) => {
                if (idx === 0) return 0;
                return acc + map.distance(coordinates[idx - 1], coordinates[idx]);
            }, 0);

            const targetDistance = (totalLength * progressRef.current) / 100;
            
            // Find current segment
            let coveredDistance = 0;
            for (let i = 0; i < coordinates.length - 1; i++) {
                const segmentLength = map.distance(coordinates[i], coordinates[i + 1]);
                if (coveredDistance + segmentLength >= targetDistance) {
                    const segmentProgress = (targetDistance - coveredDistance) / segmentLength;
                    const lat = coordinates[i][0] + (coordinates[i + 1][0] - coordinates[i][0]) * segmentProgress;
                    const lng = coordinates[i][1] + (coordinates[i + 1][1] - coordinates[i][1]) * segmentProgress;
                    markerRef.current.setLatLng([lat, lng]);
                    break;
                }
                coveredDistance += segmentLength;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
                markerRef.current = null;
            }
        };
    }, [map, coordinates, currentSpeed, color, initialOffset, startDelay]);

    return null;
};

export default VehicleMarker;
