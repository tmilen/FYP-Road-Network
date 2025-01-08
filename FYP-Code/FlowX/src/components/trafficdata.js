import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL;

const useTrafficData = () => {
    const [trafficData, setTrafficData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        intensity: 'all',
        minSpeed: '',
        maxSpeed: '',
        date: '',
        startTime: '',
        endTime: ''
    });

    const filterData = (data) => {
        return data.filter(item => {
            // Filter by intensity
            if (filters.intensity !== 'all' && item.intensity !== filters.intensity) {
                return false;
            }

            // Filter by speed range
            if (filters.minSpeed && item.currentSpeed < parseFloat(filters.minSpeed)) {
                return false;
            }
            if (filters.maxSpeed && item.currentSpeed > parseFloat(filters.maxSpeed)) {
                return false;
            }

            // Filter by date
            if (filters.date) {
                const itemDate = new Date(item.lastUpdated).toLocaleDateString('en-CA'); // YYYY-MM-DD format
                if (itemDate !== filters.date) {
                    return false;
                }
            }

            // Filter by time range
            if (filters.startTime || filters.endTime) {
                const itemTime = new Date(item.lastUpdated);
                const itemTimeString = itemTime.toTimeString().slice(0, 5); // HH:mm format

                if (filters.startTime && itemTimeString < filters.startTime) {
                    return false;
                }
                if (filters.endTime && itemTimeString > filters.endTime) {
                    return false;
                }
            }

            return true;
        });
    };

    const fetchTrafficData = useCallback(async () => {
        try {
            setLoading(true);
            // Build query parameters
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (filters.date) params.append('date', filters.date);
            if (filters.startTime) params.append('startTime', filters.startTime);
            if (filters.endTime) params.append('endTime', filters.endTime);

            const url = `${API_URL}/traffic/data${params.toString() ? `?${params.toString()}` : ''}`;
            console.log('Fetching data from:', url);

            const response = await axios.get(url);
            console.log('Received data:', response.data);

            // Apply client-side filtering for speed and intensity
            let filteredData = response.data.filter(item => {
                if (filters.intensity !== 'all' && item.intensity !== filters.intensity) {
                    return false;
                }
                if (filters.minSpeed && item.currentSpeed < parseFloat(filters.minSpeed)) {
                    return false;
                }
                if (filters.maxSpeed && item.currentSpeed > parseFloat(filters.maxSpeed)) {
                    return false;
                }
                return true;
            });

            console.log('Filtered data:', filteredData);
            setTrafficData(filteredData);
            setError(null);
        } catch (err) {
            console.error('Error fetching traffic data:', err);
            setError('Error fetching traffic data');
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filters, API_URL]);

    const fetchHistoricalDataForRoad = useCallback(async (roadId) => {
        try {
            const response = await axios.get(`${API_URL}/traffic/history?road_id=${roadId}`);
            return response.data;
        } catch (err) {
            console.error('Error fetching historical data:', err);
            return [];
        }
    }, []);

    useEffect(() => {
        fetchTrafficData();
    }, [fetchTrafficData]);

    const handleFilter = async (filterOptions) => {
        setFilters(filterOptions);
    };

    const handleExport = (data) => {
        // Convert data to CSV and download
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

    return {
        trafficData,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        handleFilter,
        handleExport,
        fetchTrafficData,
        fetchHistoricalDataForRoad,
        filters
    };
};

export default useTrafficData;
