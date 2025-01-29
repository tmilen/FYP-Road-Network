import React, { useEffect, useState } from "react";
import Navbar from "./navbar";
import useDataHealthController from "../components/datahealth";
import styles from "../css/datahealth.module.css";
import { FaTachometerAlt, FaCog } from "react-icons/fa";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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
    metrics,
    trafficLogs,
    fetchMetrics,
    fetchTrafficLogs,
  } = useDataHealthController();

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [activeTab, setActiveTab] = useState("monitoring");

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_API_URL}/models`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setModels(data.models);
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
  const chartData = {
    labels: ["Success", "Failures"],
    datasets: [
      {
        label: "API Calls",
        data: metrics
          ? [metrics.successfulCalls, metrics.failedCalls]
          : [0, 0],
        backgroundColor: ["#4caf50", "#f44336"],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "API Success vs Failure",
      },
    },
  };

  // Fetch metrics when the component mounts
  useEffect(() => {
    fetchMetrics(); // Fetch once on mount

    // Optional: Poll for updates every 5000 seconds
    const interval = setInterval(() => {
      fetchMetrics();
    },300000 );

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);



  const renderContent = () => {
    if (activeTab === "monitoring") {
      return (
        <div className={styles.dashboardContainer}>
          {/* Metrics Section */}
          <div className={styles.metricsRow}>
            {metrics ? (
              <>
                <div className={styles.metricCard}>
                  <h3>Total Roads Processed</h3>
                  <p>{metrics.totalRoads}</p>
                </div>
                <div className={styles.metricCard}>
                  <h3>Successful API Calls</h3>
                  <p>{metrics.successfulCalls}</p>
                </div>
                <div className={styles.metricCard}>
                  <h3>Failed API Calls</h3>
                  <p>{metrics.failedCalls}</p>
                </div>
                <div className={styles.metricCard}>
                  <h3>Duplicate Entries</h3>
                  <p>{metrics.duplicates}</p>
                </div>
                <div className={styles.metricCard}> 
                  <h3>Ingestion Latency</h3>
                  <p>{metrics.ingestionLatency ? `${metrics.ingestionLatency}s` : "N/A"}</p>
                </div>
              </>
            ) : (
              <p>Loading metrics...</p>
            )}
          </div>

          <div class={styles.secondRow}>

            {/* Chart Section */}
            <div className={styles.chartContainer}>
              <h2>API Success vs Failure</h2>
              <Bar data={chartData} options={chartOptions} />
            </div>

            {/* Logs Section */}
            <div className={styles.logsContainer}>
              <div className={styles.logsSection}>
                <h2>Pipeline Logs</h2>
                <div className={styles.pipelineLogsBox}>
                  {trafficLogs.length > 0 ? (
                    trafficLogs.map((log, index) => (
                      <div key={index}>
                      <p>Message: {log.message}</p>
                      <p>Road Name: {log.roadName}</p>
                      <p>Status: {log.status}</p>
                      <p>Timestamp: {log.timestamp}</p>
                      </div>))
                  ) : (
                    <p>No traffic logs available.</p>
                  )}
                </div>
                <button className={styles.pLbutton} onClick={fetchTrafficLogs}>
                  Refresh
                </button>
               
              </div>
          </div>
        </div>
        </div>
      );
    } else if (activeTab === "operations") {
      return (
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
              Upload
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
                Refresh
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
                Retrain
              </button>
              {retrainStatus && <p className={styles.status}>{retrainStatus}</p>}
            </div>
          </div>
        </div>
      );
    }
  };



  return (
    <div className={styles.page}>
      <h1 className={styles.title}>FlowX</h1>
      <Navbar sticky={false} />
      <div className={styles.sidebar}>
        <div
          className={`${styles.sidebarItem} ${
            activeTab === "monitoring" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("monitoring")}
        >
          <FaTachometerAlt />
          <div className={styles.menuContent}>
            <span className={styles.menuTitle}>Monitoring</span>
            <p className={styles.menuDescription}>Track real-time metrics and system performance</p>
          </div>
        </div>
        <div
          className={`${styles.sidebarItem} ${
            activeTab === "operations" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("operations")}
        >
          <FaCog />
          <div className={styles.menuContent}>
            <span className={styles.menuTitle}>Operations</span>
            <p className={styles.menuDescription}>Manage data uploads and model retraining</p>
          </div>
        </div>
      </div>
      <div className={styles.content}>{renderContent()}</div>
    </div>
  );
};

export default DataHealth;
