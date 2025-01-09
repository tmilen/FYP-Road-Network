import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

const VehicleMarker = ({ map, coordinates, currentSpeed = 0, color = '#2563eb' }) => {
    const markerRef = useRef(null);
    const animationFrameRef = useRef(null);

    useEffect(() => {
        if (!map || !coordinates || coordinates.length < 2) return;

        // Create vehicle marker
        const vehicleIcon = L.divIcon({
            className: 'vehicle-marker',
            html: `<div style="
                width: 12px;
                height: 12px;
                background: ${color};
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 0 4px rgba(0,0,0,0.3);">
            </div>`,
            iconSize: [12, 12],
            iconAnchor: [6, 6]
        });

        markerRef.current = L.marker(coordinates[0], { icon: vehicleIcon }).addTo(map);
        
        let currentIndex = 0;
        let lastTimestamp = 0;

        // Calculate animation speed based on current traffic speed
        // Faster traffic = faster animation
        const baseDelay = 100; // Base delay in milliseconds
        const minDelay = 50;   // Minimum delay to prevent too fast animation
        const maxDelay = 500;  // Maximum delay for very slow traffic
        
        // Scale the delay inversely with speed (faster speed = lower delay)
        const getDelay = () => {
            if (currentSpeed <= 0) return maxDelay;
            // Map speed range (0-120km/h) to delay range (500-50ms)
            const delay = maxDelay - ((currentSpeed / 120) * (maxDelay - minDelay));
            return Math.max(minDelay, Math.min(maxDelay, delay));
        };

        const animate = (timestamp) => {
            if (!lastTimestamp) lastTimestamp = timestamp;
            
            const elapsed = timestamp - lastTimestamp;
            const frameDelay = getDelay();

            if (elapsed > frameDelay) {
                currentIndex = (currentIndex + 1) % coordinates.length;
                const nextPosition = coordinates[currentIndex];
                
                if (markerRef.current && map.hasLayer(markerRef.current)) {
                    markerRef.current.setLatLng(nextPosition);

                    if (currentIndex < coordinates.length - 1) {
                        const current = coordinates[currentIndex];
                        const next = coordinates[currentIndex + 1];
                        const angle = Math.atan2(next.lat - current.lat, next.lng - current.lng) * 180 / Math.PI;
                        markerRef.current._icon.style.transform += ` rotate(${angle}deg)`;
                    }
                }
                
                lastTimestamp = timestamp;
            }

            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            if (markerRef.current) {
                map.removeLayer(markerRef.current);
            }
        };
    }, [map, coordinates, currentSpeed, color]);

    return null;
};

export default VehicleMarker;
