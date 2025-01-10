import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FaMap, FaChartLine, FaFileAlt } from 'react-icons/fa';
import { MdLocationOn } from 'react-icons/md';

const useTrafficManagement = () => {
    const navigate = useNavigate();
    const [permissions, setPermissions] = useState({});
    const API_URL = process.env.REACT_APP_API_URL;

    useEffect(() => {
        axios.get(`${API_URL}/session`, { withCredentials: true })
            .then(response => {
                if (response.data.permissions) {
                    setPermissions(response.data.permissions);
                }
            })
            .catch(error => {
                console.error("Error fetching permissions:", error);
                navigate('/');
            });
    }, [API_URL, navigate]);

    const allFeatures = [
        {
            title: 'Live Map',
            description: 'Real-time traffic monitoring and visualization',
            icon: <MdLocationOn />,
            path: '/live-map',
            color: '#4CAF50',
            permission: 'live_map'
        },
        {
            title: 'Upload Town Map',
            description: 'Import and manage town blueprints',
            icon: <FaMap />,
            path: '/upload-map',
            color: '#2196F3',
            permission: 'upload_map'
        },
        {
            title: 'Traffic Data',
            description: 'Analyze historical and current traffic patterns',
            icon: <FaChartLine />,
            path: '/traffic-data',
            color: '#9C27B0',
            permission: 'traffic_data'
        },
        {
            title: 'Reports',
            description: 'Generate and view traffic analysis reports',
            icon: <FaFileAlt />,
            path: '/reports',
            color: '#FF9800',
            permission: 'report'
        }
    ];

    // Filter features based on permissions
    const availableFeatures = allFeatures.filter(feature => 
        permissions[feature.permission]
    );

    return {
        availableFeatures,
        navigate
    };
};

export default useTrafficManagement;
