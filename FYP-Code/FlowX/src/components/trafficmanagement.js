import { useState, useEffect } from 'react';
import axios from 'axios';

const useTrafficManagement = () => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadMessage, setUploadMessage] = useState('');
    const [uploadedData, setUploadedData] = useState(null);
    const [mapsList, setMapsList] = useState([]);
    const [selectedMap, setSelectedMap] = useState('');
    const API_URL = process.env.REACT_APP_API_URL;
    const MESSAGE_TIMEOUT = 5000; // 5 seconds

    const showTimedMessage = (message, isError = false) => {
        setUploadMessage(message);
        setTimeout(() => {
            setUploadMessage('');
        }, MESSAGE_TIMEOUT);
    };

    const fetchMapsList = async () => {
        try {
            console.log("Fetching maps list...");  // Debug log
            const response = await axios.get(`${API_URL}/maps`, { withCredentials: true });
            console.log("Maps received:", response.data);  // Debug log
            setMapsList(response.data);
        } catch (error) {
            console.error("Error fetching maps:", error);
            setUploadMessage('Error fetching maps list.');
        }
    };

    useEffect(() => {
        // Check session and fetch maps list
        const initializeData = async () => {
            try {
                const sessionResponse = await axios.get(`${API_URL}/session`, { withCredentials: true });
                if (!sessionResponse.data.username) {
                    setUploadMessage('You must be logged in to upload files.');
                    return;
                }
                await fetchMapsList();
            } catch (error) {
                console.error("Error during initialization:", error);
                setUploadMessage('Error fetching session data. Please log in.');
            }
        };

        initializeData();
    }, [API_URL]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'text/xml') {
            setSelectedFile(file);
            setUploadMessage('');
        } else {
            setSelectedFile(null);
            showTimedMessage('Please select a valid XML file.', true);
        }
    };

    const handleFileUpload = async (event) => {
        event.preventDefault();
        if (!selectedFile) {
            showTimedMessage('Please select a file to upload.', true);
            return;
        }

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const response = await axios.post(`${API_URL}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                },
                withCredentials: true
            });
            showTimedMessage(response.data.message || 'File uploaded successfully.');
            setSelectedFile(null);
            fetchMapsList();
        } catch (error) {
            showTimedMessage('Error uploading file: ' + (error.response?.data?.message || error.message), true);
        }
    };

    const fetchUploadedData = async (fileId) => {
        try {
            const response = await axios.get(`${API_URL}/files/${fileId}`, { withCredentials: true });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.data.data, 'text/xml');
            const svgElement = xmlDoc.querySelector('svg');
            
            if (svgElement) {
                setUploadedData({
                    svgContent: svgElement.outerHTML
                });
            } else {
                setUploadMessage('No SVG content found in the uploaded file.');
            }
        } catch (error) {
            console.error("Error fetching uploaded data:", error);
            setUploadMessage('Error fetching uploaded data.');
        }
    };

    const handleDisplayMap = async () => {
        if (!selectedMap) return;

        try {
            const response = await axios.get(`${API_URL}/files/${selectedMap}`, { withCredentials: true });
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(response.data.data, 'text/xml');
            const svgElement = xmlDoc.querySelector('svg');
            
            if (svgElement) {
                setUploadedData({
                    svgContent: svgElement.outerHTML
                });
                showTimedMessage('Map displayed successfully.');
            } else {
                showTimedMessage('No SVG content found in the selected file.', true);
            }
        } catch (error) {
            console.error("Error displaying map:", error);
            showTimedMessage('Error displaying map.', true);
        }
    };

    return {
        selectedFile,
        uploadMessage,
        handleFileChange,
        handleFileUpload,
        uploadedData,
        mapsList,
        selectedMap,
        setSelectedMap,
        handleDisplayMap
    };
};

export default useTrafficManagement;
