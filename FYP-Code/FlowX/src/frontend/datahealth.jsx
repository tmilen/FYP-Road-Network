import React, { useEffect, useState } from "react";
import Navbar from "./navbar";
import useDataHealthController from "../components/datahealth";
import styles from "../css/datahealth.module.css";
import { FaTachometerAlt, FaCog, FaDatabase, FaServer, FaHdd, FaDatabase as FaDbIcon } from "react-icons/fa";
import { RiDeleteBin6Line } from "react-icons/ri";
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
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const CollectionPopup = ({ collectionName, collectionSize, onClose }) => {
  const [data, setData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const { fetchCollectionData, formatSize } = useDataHealthController();

  const calculateDocumentSize = (doc) => {
    // Convert document to string and calculate size in bytes
    const docString = JSON.stringify(doc);
    const size = new Blob([docString]).size;
    
    // Format size
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  useEffect(() => {
    const loadData = async () => {
      const result = await fetchCollectionData(collectionName, currentPage);
      setData(result);
      setLoading(false);
    };
    loadData();
  }, [collectionName, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleDelete = async (documentId) => {
    // Custom toast UI for confirmation
    const toastId = toast(
      <div>
        <p className={styles.confirmMessage}>Are you sure you want to delete this record?</p>
        <div className={styles.confirmButtons}>
          <button
            onClick={() => {
              deleteDocument(documentId);
              toast.dismiss(toastId);
            }}
            className={styles.confirmYes}
          >
            Yes, delete it
          </button>
          <button
            onClick={() => toast.dismiss(toastId)}
            className={styles.confirmNo}
          >
            Cancel
          </button>
        </div>
      </div>,
      {
        position: "top-center",
        autoClose: false,
        closeButton: false,
        draggable: false,
        closeOnClick: false,
      }
    );
  };

  const deleteDocument = async (documentId) => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/collection-data/${collectionName}/${documentId}`,
        { method: 'DELETE' }
      );
      if (response.ok) {
        toast.success('Record deleted successfully');
        // Refresh the data after deletion
        const result = await fetchCollectionData(collectionName, currentPage);
        setData(result);
      } else {
        toast.error('Failed to delete record');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error deleting record');
    }
  };

  const renderTableHeaders = (document) => {
    if (!document) return null;
    return (
      <>
        {Object.keys(document).map(key => (
          <th key={key}>{key}</th>
        ))}
        <th>Size</th>
        <th>Actions</th>
      </>
    );
  };

  const renderTableRow = (document) => {
    return (
      <>
        {Object.values(document).map((value, index) => (
          <td key={index}>
            {typeof value === 'object' ? JSON.stringify(value) : value}
          </td>
        ))}
        <td>{calculateDocumentSize(document)}</td>
        <td>
          <button
            className={styles.deleteButton}
            onClick={() => handleDelete(document._id)}
            title="Delete record"
          >
            <RiDeleteBin6Line />
          </button>
        </td>
      </>
    );
  };

  const renderPagination = (currentPage, totalPages) => {
    const getPageNumbers = () => {
      const pages = [];
      const showEllipsis = totalPages > 7;
  
      if (showEllipsis) {
        // Always show first page
        pages.push(1);
  
        // Show pages around current page
        let start = Math.max(2, currentPage - 2);
        let end = Math.min(totalPages - 1, currentPage + 2);
  
        // Add ellipsis if needed
        if (start > 2) pages.push('...');
  
        // Add pages
        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
  
        // Add ellipsis if needed
        if (end < totalPages - 1) pages.push('...');
  
        // Always show last page
        pages.push(totalPages);
      } else {
        // Show all pages if total is 7 or less
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      }
  
      return pages;
    };
  
    return (
      <div className={styles.pagination}>
        <button
          className={`${styles.pageButton} ${styles.navButton}`}
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1}
        >
          &laquo;
        </button>
        <button
          className={`${styles.pageButton} ${styles.navButton}`}
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          &lsaquo;
        </button>
  
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            className={`${styles.pageButton} ${page === currentPage ? styles.active : ''} ${page === '...' ? styles.ellipsis : ''}`}
            onClick={() => page !== '...' && handlePageChange(page)}
            disabled={page === '...'}
          >
            {page}
          </button>
        ))}
  
        <button
          className={`${styles.pageButton} ${styles.navButton}`}
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          &rsaquo;
        </button>
        <button
          className={`${styles.pageButton} ${styles.navButton}`}
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages}
        >
          &raquo;
        </button>
      </div>
    );
  };

  return (
    <>
      <div className={styles.popupOverlay} onClick={onClose} />
      <div className={styles.popup}>
        <div className={styles.popupHeader}>
          <div className={styles.collectionInfo}>
            <h3 className={styles.popupTitle}>Collection: {collectionName}</h3>
            <span className={styles.collectionSize}>
              Size: {formatSize(collectionSize)}
            </span>
          </div>
          <button className={styles.closeButton} onClick={onClose}>&times;</button>
        </div>
        
        <div className={styles.collectionContent}>
          {loading ? (
            <p>Loading...</p>
          ) : data?.documents?.length > 0 ? (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      {renderTableHeaders(data.documents[0])}
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((doc, index) => (
                      <tr key={index}>
                        {renderTableRow(doc)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {data.total_pages > 1 && renderPagination(currentPage, data.total_pages)}
            </>
          ) : (
            <p className={styles.emptyMessage}>No data available in this collection</p>
          )}
        </div>
      </div>
      <ToastContainer />
    </>
  );
};

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
    storageMetrics,
    selectedCollection,
    setSelectedCollection,
    fetchStorageMetrics,
    fetchCollectionData,
    formatSize,
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

  useEffect(() => {
    if (activeTab === "storage") {
      fetchStorageMetrics();
      const interval = setInterval(fetchStorageMetrics, 300000); // Update every 5 minutes
      return () => clearInterval(interval);
    }
  }, [activeTab]);

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
            </div>
          </div>
        </div>
      );
    } else if (activeTab === "storage") {
      const usedPercentage = (storageMetrics.usedSize / storageMetrics.totalSize) * 100;

      return (
        <div className={styles.storageContainer}>
          <h2 className={styles.dashboardTitle}>Storage Dashboard</h2>
          
          {/* Main Storage Card */}
          <div className={styles.storageCard}>
            <div className={styles.storageHeader}>
              <FaServer className={styles.storageIcon} />
              <h3>Total Database Storage</h3>
            </div>
            <div className={styles.storageProgressContainer}>
              <div 
                className={styles.storageProgressBar}
                style={{
                  background: `linear-gradient(to right, 
                    ${usedPercentage > 90 ? '#ff4444' : 
                      usedPercentage > 70 ? '#ffa000' : '#00C853'} 
                    ${usedPercentage}%, #e0e0e0 ${usedPercentage}%)`
                }}
              />
              <div className={styles.storageLabels}>
                <span>{formatSize(storageMetrics.usedSize)}</span>
                <span>{formatSize(storageMetrics.totalSize)}</span>
              </div>
              <div className={styles.storagePercentage}>
                {usedPercentage.toFixed(1)}% Used
              </div>
            </div>
          </div>

          {/* Collection Details */}
          <div className={styles.collectionsGrid}>
            {storageMetrics.databases?.map((database, dbIndex) => (
              <div key={dbIndex} className={styles.databaseCard}>
                <div className={styles.databaseHeader}>
                  <FaDatabase className={styles.databaseIcon} />
                  <h4>{database.name}</h4>
                </div>
                <div className={styles.databaseStats}>
                  <div className={styles.statItem}>
                    <span>Size:</span>
                    <span>{formatSize(database.size)}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span>Collections:</span>
                    <span>{database.collections.length}</span>
                  </div>
                </div>
                <div className={styles.collectionsList}>
                  {database.collections.map((collection, collIndex) => (
                    <div key={collIndex} className={styles.collectionItem}>
                      <div 
                        className={styles.collectionName}
                        onClick={() => setSelectedCollection({
                          name: collection.name,
                          size: collection.size
                        })}
                      >
                        <span>{collection.name}</span>
                        <span>{formatSize(collection.size)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div 
                  className={styles.databaseProgress}
                  style={{
                    width: `${(database.size / storageMetrics.totalSize) * 100}%`
                  }}
                />
              </div>
            ))}
          </div>
          {selectedCollection && (
            <CollectionPopup
              collectionName={selectedCollection.name}
              collectionSize={selectedCollection.size}
              onClose={() => setSelectedCollection(null)}
            />
          )}
        </div>
      );
    }
  };

  return (
    <div className={styles.page}>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick={false}
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
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
        <div
          className={`${styles.sidebarItem} ${
            activeTab === "storage" ? styles.active : ""
          }`}
          onClick={() => setActiveTab("storage")}
        >
          <FaDatabase />
          <div className={styles.menuContent}>
            <span className={styles.menuTitle}>Data Storage</span>
            <p className={styles.menuDescription}>Manage database storage</p>
          </div>
        </div>
      </div>
      <div className={styles.content}>{renderContent()}</div>
    </div>
  );
};

export default DataHealth;
