import { useState, useEffect } from "react";
import axios from "axios";
import { toast, Bounce } from 'react-toastify';

const useDataHealthController = () => {
  // Toast configuration
  const toastConfig = {
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "light",
    transition: Bounce,
  };

  // Remove status states that are no longer needed
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null); 
  const [trafficLogs, setTrafficLogs] = useState([]); 
  const [storageMetrics, setStorageMetrics] = useState({
    totalSize: 0,
    usedSize: 0,
    collections: []
  });
  const [selectedCollection, setSelectedCollection] = useState(null);

  const API_URL = process.env.REACT_APP_API_URL;

  const uploadZip = async () => {
    if (!file) {
      toast.error("Please select a file to upload", toastConfig);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const toastId = toast.info("Uploading file...", { ...toastConfig, toastId: 'upload-progress' });
      const response = await axios.post(`${API_URL}/upload-zip`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          setUploadProgress(progress);
        },
      });

      console.log("Upload response received:", response);

      if (response.status === 200 && response.data.message) {
          toast.update(toastId, { 
              render: response.data.message,
              type: toast.TYPE.SUCCESS,
              autoClose: 3000
          });
      } else {
          toast.update(toastId, { 
              render: "Upload completed, but response format is unexpected",
              type: toast.TYPE.WARNING,
              autoClose: 3000
          });
      }

      setUploadProgress(0);
      setFile(null);
    } catch (error) {
      console.error("Upload error:", error.response);

      let errorMessage = "Failed to upload file";
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;  // Show actual backend error
      }

      // Ensure error toast updates the same notification
      toast.update('upload-progress', { 
        render: errorMessage,
        type: toast.TYPE.ERROR,
        autoClose: 3000
      });

      setUploadProgress(0);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/logs`);
      setLogs(response.data.logs);
      toast.success("Logs refreshed successfully", toastConfig);
    } catch (error) {
      toast.error("Error fetching logs", toastConfig);
      setLogs([]);
    }
  };

  const retrainModel = async (selectedModel) => {
    if (!selectedModel) {
      toast.error("Please select a model to retrain", toastConfig);
      return;
    }
  
    try {
      const response = await axios.post(`${API_URL}/retrain`, {
        model: selectedModel,
      });
      
      toast.info("Retraining started...", { ...toastConfig, toastId: 'retrain-status' });
  
      // Fetch logs periodically
      const intervalId = setInterval(async () => {
        const logsResponse = await axios.get(`${API_URL}/logs`);
        setLogs(logsResponse.data.logs);
  
        if (logsResponse.data.trainingComplete) {
          clearInterval(intervalId);
          toast.update('retrain-status', {
            render: "Retraining completed successfully",
            type: toast.TYPE.SUCCESS,
            autoClose: 3000
          });
        }
      }, 2000);
    } catch (error) {
      toast.error("Error retraining model", toastConfig);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await axios.get(`${API_URL}/metrics`);
      setMetrics(response.data);
    } catch (error) {
      console.error("Error fetching metrics:", error);
    }
  };

  // Fetch pipeline logs
  const fetchTrafficLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/live-traffic-logs`);
      setTrafficLogs(response.data.logs);
      
    } catch (error) {
      console.error("Error fetching traffic logs:", error);
    }
  };

  const fetchPieChartData = async () => {
    try {
      const response = await axios.get(`${API_URL}/pie-chart-data`);
      const data = response.data;
      return {
        labels: data.labels,
        datasets: [
          {
            data: data.values,
            backgroundColor: ["#006400", "#e74c3c"], 
          },
        ],
      };
    } catch (error) {
      console.error("Error fetching pie chart data:", error);
      return null;
    }
  };

  const fetchLineChartData = async () => {
    try {
      const response = await axios.get(`${API_URL}/line-chart-data`);
      const data = response.data;
      return {
        labels: data.labels,
        datasets: data.datasets.map((dataset) => ({
          ...dataset,
          borderColor: dataset.label === "Successful Calls" ? "#4caf50" : dataset.label === "Failed Calls" ? "#f44336" : "#ff9800",
          backgroundColor: dataset.label === "Successful Calls" ? "rgba(76, 175, 80, 0.2)" : dataset.label === "Failed Calls" ? "rgba(244, 67, 54, 0.2)" : "rgba(255, 152, 0, 0.2)",
          fill: true,
        })),
      };
    } catch (error) {
      console.error("Error fetching line chart data:", error);
      return null;
    }
  };

  // Format size helper function
  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Fetch storage metrics
  const fetchStorageMetrics = async () => {
    try {
      const response = await axios.get(`${API_URL}/storage-metrics`);
      setStorageMetrics(response.data);
    } catch (error) {
      console.error("Error fetching storage metrics:", error);
    }
  };

  // Collection data fetching
  const fetchCollectionData = async (collectionName, page = 1) => {
    try {
      const response = await axios.get(
        `${API_URL}/collection-data?name=${collectionName}&page=${page}`
      );
      return response.data;
    } catch (error) {
      toast.error('Error fetching collection data', toastConfig);
      return null;
    }
  };

  useEffect(() => {
    fetchTrafficLogs();

    const interval = setInterval(fetchTrafficLogs, 300000); 
    return () => clearInterval(interval);
  }, []);

  return {
    file,
    uploadProgress, 
    logs,
    metrics,
    trafficLogs,
    setFile,
    uploadZip,
    fetchLogs,
    retrainModel,
    fetchMetrics,
    fetchTrafficLogs,
    fetchPieChartData,
    fetchLineChartData,
    storageMetrics,
    selectedCollection,
    setSelectedCollection,
    fetchStorageMetrics,
    fetchCollectionData,
    formatSize,
  };
};

export default useDataHealthController;

