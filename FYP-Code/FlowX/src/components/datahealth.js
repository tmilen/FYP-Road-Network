import { useState, useEffect } from "react";
import axios from "axios";

const useDataHealthController = () => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [retrainStatus, setRetrainStatus] = useState("");
  const [metrics, setMetrics] = useState(null); 
  const [trafficLogs, setTrafficLogs] = useState([]); 

  const API_URL = process.env.REACT_APP_API_URL;

  const uploadZip = async () => {

    const formData = new FormData();
    formData.append("file", file);

    try {
      setUploadStatus("Uploading..."); // Show status when upload starts
      const response = await axios.post(`${API_URL}/upload-zip`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round(
            (progressEvent.loaded / progressEvent.total) * 100
          );
          setUploadProgress(progress);
        },
      });
      setUploadStatus(response.data.message);
      setUploadProgress(0);
    } catch (error) {
      setUploadStatus(error.response?.data?.error || "Failed to upload zip file. Please try again.");
      setUploadProgress(0);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/logs`);
      setLogs(response.data.logs);
    } catch (error) {
      setLogs(["Error fetching logs. Please try again later."]);
    }
  };

  const retrainModel = async (selectedModel) => {
    if (!selectedModel) {
      setRetrainStatus("Please select a model to retrain.");
      return;
    }
  
    try {
      const response = await axios.post(`${API_URL}/retrain`, {
        model: selectedModel,
      });
      setRetrainStatus("Retraining started. Fetching logs...");
  
      // Fetch logs periodically
      const intervalId = setInterval(async () => {
        const logsResponse = await axios.get(`${API_URL}/logs`);
        setLogs(logsResponse.data.logs);
  
        if (logsResponse.data.trainingComplete) {
          clearInterval(intervalId); // Stop fetching logs when training is complete
          setRetrainStatus("Retraining complete.");
        }
      }, 2000); // Fetch logs every 2 seconds
    } catch (error) {
      setRetrainStatus("Error retraining the model. Please try again.");
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

  useEffect(() => {
    fetchTrafficLogs();

    const interval = setInterval(fetchTrafficLogs, 300000); 
    return () => clearInterval(interval);
  }, []);

  return {
    file,
    uploadStatus,
    setUploadStatus, 
    uploadProgress,
    setUploadProgress, 
    retrainStatus,
    setFile,
    uploadZip,
    fetchLogs,
    retrainModel,
    metrics,
    trafficLogs,
    fetchMetrics,
    fetchTrafficLogs,
    fetchPieChartData,
    fetchLineChartData,
  };
};

export default useDataHealthController;

