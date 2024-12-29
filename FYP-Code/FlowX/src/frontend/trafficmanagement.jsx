import React from 'react';
import Navbar from './navbar';
import styles from '../css/trafficmanagement.module.css';
import useTrafficManagement from '../components/trafficmanagement';
import { RiFileUploadLine } from "react-icons/ri";
import { BsFiletypeXml } from "react-icons/bs";
import { FaPlaystation, FaCog, FaExpand, FaSearch } from "react-icons/fa";  // Add this import

function TrafficManagement() {
    const {
        selectedFile,
        uploadMessage,
        handleFileChange,
        handleFileUpload,
        uploadedData,
        mapsList,
        selectedMap,
        setSelectedMap,
        handleDisplayMap
    } = useTrafficManagement();

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />
            <div className={styles.navbarGap}></div>
            <div className={styles.mainContainer}>
                <div className={styles.controlPanel}>
                    <div className={styles.controlCard}>
                        <h2>Map Controls</h2>
                        <div className={styles.uploadSection}>
                            <h3>Upload New Map</h3>
                            <form onSubmit={handleFileUpload} className={styles.uploadForm}>
                                <label className={styles.fileInputLabel}>
                                    <BsFiletypeXml className={styles.fileIcon} />
                                    <input 
                                        type="file" 
                                        accept=".xml" 
                                        onChange={handleFileChange} 
                                        className={styles.fileInput}
                                        key={selectedFile ? 'has-file' : 'no-file'} 
                                    />
                                </label>
                                <button type="submit" className={styles.uploadButton}>
                                    <RiFileUploadLine className={styles.uploadIcon} />
                                </button>
                                <span className={styles.fileName}>
                                    {selectedFile ? selectedFile.name : "No file chosen"}
                                </span>
                            </form>
                        </div>

                        <div className={styles.selectionSection}>
                            <h3>Select Existing Map</h3>
                            <div className={styles.mapSelectionContainer}>
                                <select 
                                    className={styles.mapSelect}
                                    value={selectedMap}
                                    onChange={(e) => setSelectedMap(e.target.value)}
                                >
                                    <option value="">Choose map</option>
                                    {mapsList.map((map) => (
                                        <option key={map._id} value={map._id}>
                                            {map.filename} ({new Date(map.uploadDate).toLocaleString('en-GB', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })})
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    className={styles.displayButton}
                                    onClick={handleDisplayMap}
                                    disabled={!selectedMap}
                                >
                                    <FaPlaystation className={styles.displayIcon} />
                                </button>
                            </div>
                        </div>

                        {uploadMessage && (
                            <div className={uploadMessage.includes('successfully') ? styles.successMessage : styles.errorMessage}>
                                {uploadMessage}
                            </div>
                        )}
                    </div>
                </div>

                <div className={styles.mapDisplay}>
                    <div className={styles.mapCard}>
                        <div className={styles.mapHeader}>
                            <h2>Map Visualization</h2>
                            <div className={styles.mapControls}>
                                <button className={styles.mapControlButton}>
                                    <FaSearch />
                                </button>
                                <button className={styles.mapControlButton}>
                                    <FaExpand />
                                </button>
                                <button className={styles.mapControlButton}>
                                    <FaCog />
                                </button>
                            </div>
                        </div>
                        <div className={styles.mapContainer}>
                            {uploadedData ? (
                                <div className={styles.svgContainer} dangerouslySetInnerHTML={{ __html: uploadedData.svgContent }} />
                            ) : (
                                <div className={styles.placeholderMessage}>
                                    <p>Select a map to display</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default TrafficManagement;
