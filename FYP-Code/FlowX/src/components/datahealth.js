import { useState } from "react";
import axios from "axios";

const useDataHealthController = () => {
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [retrainStatus, setRetrainStatus] = useState("");

  const API_URL = process.env.REACT_APP_API_URL;

  const uploadZip = async () => {
    if (!file) {
      setUploadStatus("Please select a .zip file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
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
      setUploadStatus("Failed to upload zip file. Please try again.");
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

  return {
    file,
    uploadStatus,
    uploadProgress,
    logs,
    retrainStatus,
    setFile,
    uploadZip,
    fetchLogs,
    retrainModel,
  };
};

export default useDataHealthController;

