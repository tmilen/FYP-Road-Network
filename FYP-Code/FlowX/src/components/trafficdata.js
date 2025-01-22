import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const useTrafficData = () => {
    const [trafficData, setTrafficData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchTrafficData = useCallback(async (filters = {}) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (searchTerm.trim()) {
                params.append('search', searchTerm.trim());
            }
            
            // Add filter parameters if they exist
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.startTime) params.append('startTime', filters.startTime);
            if (filters.endTime) params.append('endTime', filters.endTime);

            // Add condition filters
            if (filters.conditions && filters.conditions.length > 0) {
                filters.conditions.forEach(condition => {
                    params.append('conditions', condition);
                });
            }

            const url = `${API_URL}/traffic/data${params.toString() ? `?${params.toString()}` : ''}`;
            console.log('[SEARCH] Fetching data with URL:', url);

            const response = await axios.get(url);
            console.log('[SEARCH] Received data:', response.data);

            // Sort data alphabetically by street name and add incident warning flags
            const sortedData = [...response.data].sort((a, b) => 
                a.streetName.localeCompare(b.streetName)
            ).map(item => ({
                ...item,
                hasAccidents: item.accidentCount > 0,
                hasCongestion: item.congestionCount > 0
            }));

            setTrafficData(sortedData);
            setError(null);
        } catch (err) {
            console.error('[SEARCH] Error fetching traffic data:', err);
            setError('Error fetching traffic data');
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    // Add debounced search effect
    useEffect(() => {
        const delayDebounce = setTimeout(() => {
            fetchTrafficData();
        }, 300); // 300ms delay

        return () => clearTimeout(delayDebounce);
    }, [searchTerm, fetchTrafficData]);

    const fetchHistoricalDataForRoad = useCallback(async (roadId, filters = {}) => {
        try {
            console.log(`Fetching historical data for road: ${roadId}`);
            const params = new URLSearchParams({ road_id: roadId });
            
            // Add filter parameters if they exist
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.startTime) params.append('startTime', filters.startTime);
            if (filters.endTime) params.append('endTime', filters.endTime);

            // Add condition filters
            if (filters.conditions && filters.conditions.length > 0) {
                filters.conditions.forEach(condition => {
                    params.append('conditions', condition);
                });
            }

            const response = await axios.get(`${API_URL}/traffic/history?${params.toString()}`);
            console.log('Received historical data:', response.data);
            return {
                data: response.data.data || [], // Ensure we return an array
                totalIncidents: response.data.totalIncidents
            };
        } catch (err) {
            console.error('Error fetching historical data:', err);
            return { data: [], totalIncidents: 0 }; // Return empty array on error
        }
    }, []);

    const handleExport = (data) => {
        const headers = ['Street Name', 'Date', 'Time', 'Current Speed', 'Free Flow Speed', 'Traffic Condition'];
        const csvData = data.map(item => [
            item.streetName,
            new Date(item.lastUpdated).toLocaleDateString(),
            new Date(item.lastUpdated).toLocaleTimeString(),
            item.currentSpeed,
            item.freeFlowSpeed,
            item.intensity === 'low' ? 'Light' : item.intensity === 'medium' ? 'Moderate' : 'Heavy'
        ]);

        const csvContent = [
            headers.join(','),
            ...csvData.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'traffic_data.csv';
        link.click();
    };

    const handleTimeChange = (currentTimeRange, setTimeRange, type, value) => {
        if (type === 'start') {
            // When changing start time
            if (currentTimeRange.end && value > currentTimeRange.end) {
                // If new start time is later than current end time, reset end time
                setTimeRange({ start: value, end: '' });
            } else {
                setTimeRange({ ...currentTimeRange, start: value });
            }
        } else {
            // When changing end time
            if (value < currentTimeRange.start) {
                // Prevent setting end time earlier than start time
                return;
            }
            setTimeRange({ ...currentTimeRange, end: value });
        }
    };

    return {
        trafficData,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        handleExport,
        fetchTrafficData,
        fetchHistoricalDataForRoad,
        handleTimeChange,
    };
};

export default useTrafficData;
