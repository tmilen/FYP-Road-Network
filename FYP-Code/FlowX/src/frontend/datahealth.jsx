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
  ArcElement,
  PointElement,
  LineElement,
} from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const DataHealth = () => {
  const {
    retrainModel,
    uploadZip,
    fetchLogs,
    file,
    setFile,
    logs,
    uploadStatus,
    setUploadStatus,
    retrainStatus,
    uploadProgress,
    setUploadProgress,
    metrics,
    trafficLogs,
    fetchMetrics,
    fetchTrafficLogs,
    fetchPieChartData,
    fetchLineChartData,
  } = useDataHealthController();

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [activeTab, setActiveTab] = useState("monitoring");
  const [pieChartData, setPieChartData] = useState(null);
  const [lineChartData, setLineChartData] = useState(null);

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
        data: metrics ? [metrics.successfulCalls, metrics.failedCalls] : [0, 0],
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

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Unique vs Duplicate Entries",
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.raw;
            const total = context.chart._metasets[0].total;
            const percentage = ((value / total) * 100).toFixed(2);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
    },
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
      title: {
        display: true,
        text: "Records Processed Over Time",
      },
    },
  };

  // Fetch metrics when the component mounts
  useEffect(() => {
    fetchMetrics(); // Fetch once on mount
    fetchPieChartData().then((data) => setPieChartData(data)); // Fetch pie chart data
    fetchLineChartData().then((data) => setLineChartData(data)); // Fetch line chart data

    const interval = setInterval(() => {
      fetchMetrics();
      fetchPieChartData().then((data) => setPieChartData(data));
      fetchLineChartData().then((data) => setLineChartData(data));
    }, 300000);

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  useEffect(() => {
    if (uploadStatus) {
      const timer = setTimeout(() => {
        setUploadStatus("");
        setUploadProgress(0);
        setFile(null); // Clear the file after 8 seconds
      }, 8000); // Hide after 8 seconds

      return () => clearTimeout(timer); // Cleanup timer on unmount
    }
  }, [uploadStatus]);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setUploadStatus(""); 
    setUploadProgress(0); 
  };

  const renderContent = () => {
    if (activeTab === "monitoring") {
      return (
        <div className={styles.dashboardContainer}>
          <h2 className={styles.dashboardTitle}>Data Health Dashboard</h2>
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

          <div className={styles.secondRow}>
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
                  {trafficLogs && trafficLogs.length > 0 ? (
                    trafficLogs.map((log, index) => (
                      <div key={index}>
                        <p>Message: {log.message}</p>
                        <p>Road Name: {log.roadName}</p>
                        <p>Status: {log.status}</p>
                        <p>Timestamp: {log.timestamp}</p>
                      </div>
                    ))
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

          <div className={styles.thirdRow}>
            {/* Pie Chart Section */}
            <div className={styles.piechartContainer}>
              <h2>Data Distribution</h2>
              {pieChartData ? (
                <Pie data={pieChartData} options={pieOptions} />
              ) : (
                <p>Loading pie chart data...</p>
              )}
            </div>

            {/* Line Chart Section */}
            <div className={styles.linechartContainer}>
              <h2>API Calls Over Time</h2>
              {lineChartData ? (
                <Line data={lineChartData} options={lineChartOptions} />
              ) : (
                <p>Loading line chart data...</p>
              )}
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
                onChange={handleFileChange}
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
                {logs && logs.length > 0 ? (
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
