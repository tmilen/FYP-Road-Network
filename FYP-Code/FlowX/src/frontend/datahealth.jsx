import React, { useEffect, useState } from "react";
import Navbar from "./navbar";
import useDataHealthController from "../components/datahealth";
import styles from "../css/datahealth.module.css";

const DataHealth = () => {
  const {
    retrainModel,
    uploadZip,
    fetchLogs,
    file,
    setFile,
    logs,
    uploadStatus,
    retrainStatus,
    uploadProgress,
  } = useDataHealthController();

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/models`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setModels(data.models); // Populate models with the list of files from the backend
      } catch (error) {
        console.error("Error fetching models:", error);
      }
    };
  
    fetchModels(); 
  }, []);

  const handleRetrain = () => {
    if (selectedModel) {
      retrainModel(selectedModel);
    } else {
      alert("Please select a model to retrain.");
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>FlowX</h1>
      <Navbar sticky={false} />

      <div className={styles.mainContainer}>
        <div className={styles.section}>
          <h2>Upload Dataset as Zip</h2>
          <div className={styles.uploadBox}>
            <input
              type="file"
              id="file-upload"
              accept=".zip"
              onChange={(e) => setFile(e.target.files[0])}
              className={styles.fileInput}
            />
            <label htmlFor="file-upload" className={styles.uploadLabel}>
              Click to upload a .zip file
            </label>
          </div>
          <div className={styles.supportedInfo}>
            Supported formats: .zip only | Maximum size: 500MB
          </div>
          <button className={styles.button} onClick={uploadZip}>
            Upload Zip File
          </button>
          {uploadStatus && <p className={styles.status}>{uploadStatus}</p>}

          {file && (
            <div className={styles.progressContainer}>
              <div className={styles.progressInfo}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileSize}>
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className={styles.progressBar}>
                <div style={{ width: `${uploadProgress}%` }}></div>
              </div>
              <span className={styles.progressPercentage}>
                {uploadProgress}%
              </span>
            </div>
          )}
        </div>

        <div className={styles.gridContainer}>
          <div className={styles.card}>
            <h2>Logs</h2>
            <div className={styles.logsBox}>
              {logs.length > 0 ? (
                logs.map((log, index) => <p key={index}>{log}</p>)
              ) : (
                <p>No logs available.</p>
              )}
            </div>
            <button className={styles.button} onClick={fetchLogs}>
              Refresh Logs
            </button>
          </div>

          <div className={styles.card}>
            <h2>Choose Model</h2>
            <div className={styles.templateSelector}>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={styles.select}
              >
                <option value="" disabled>
                  Select a model
                </option>
                {models.map((model, index) => (
                  <option key={index} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
            <button className={styles.button} onClick={handleRetrain}>
              Retrain Model
            </button>
            {retrainStatus && <p className={styles.status}>{retrainStatus}</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DataHealth;
