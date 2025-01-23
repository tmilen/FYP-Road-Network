import React from 'react';
import Navbar from './navbar';
import styles from '../css/uploadmap.module.css';
import useUploadMap from '../components/uploadmap';
import { RiFileUploadLine } from "react-icons/ri";
import { BsFiletypeXml } from "react-icons/bs";
import { FaPlaystation, FaCog } from "react-icons/fa";
import { GiAk47 } from "react-icons/gi";
import { IoIosAirplane, IoIosBusiness } from "react-icons/io";
import { FaCarSide } from 'react-icons/fa';
import { FaRoad, FaTrash } from 'react-icons/fa';  // Add this import


function UploadMap() {
    const {
        selectedFile,
        uploadMessage,
        handleFileChange,
        handleFileUpload,
        uploadedData,
        mapsList,
        selectedMap,
        setSelectedMap,
        handleDisplayMap,
        handleDeleteMap,
        handleClearMap,
        isTrafficVisible,
        handleToggleTraffic,
        isDrawingMode,
        handleAddRoadClick,
        handleMapClick,
        handleMapMouseMove,
        tempRoad,
        // Add these two lines
        isRemovingMode,
        handleRemoveRoadClick,
    } = useUploadMap();

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
                                <button 
                                    className={`${styles.displayButton} ${styles.deleteButton}`}
                                    onClick={handleDeleteMap}
                                    disabled={!selectedMap}
                                >
                                    <GiAk47 className={styles.displayIcon} />
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
                            <div className={styles.mapHeaderLeft}>
                                <h2>Map Visualization</h2>
                                {uploadedData && uploadedData.roadCount && (
                                    <span className={styles.roadCount}>
                                        Roads: {uploadedData.roadCount}
                                    </span>
                                )}
                            </div>
                            <div className={styles.mapControls}>
                                <button 
                                    className={`${styles.mapControlButton} ${styles.clearButton}`}
                                    onClick={handleClearMap}
                                    disabled={!uploadedData}
                                >
                                    <IoIosAirplane />
                                </button>
                                <button 
                                    className={`${styles.mapControlButton} ${styles.addRoad} ${isDrawingMode ? styles.active : ''}`}
                                    onClick={handleAddRoadClick}
                                    disabled={!uploadedData}
                                >
                                    <FaRoad />
                                </button>
                                <button 
                                    className={`${styles.mapControlButton} ${styles.removeRoad} ${isRemovingMode ? styles.active : ''}`}
                                    onClick={handleRemoveRoadClick}
                                    disabled={!uploadedData}
                                >
                                    <FaTrash />
                                </button>
                                <button className={styles.mapControlButton}>
                                    <IoIosBusiness />
                                </button>
                                <button className={styles.mapControlButton}>
                                    <IoIosBusiness />
                                </button>
                                <button className={styles.mapControlButton}>
                                    <FaCog />
                                </button>
                                <button 
                                    className={`${styles.mapControlButton} ${isTrafficVisible ? styles.active : ''}`}
                                    onClick={handleToggleTraffic}
                                    disabled={!uploadedData}
                                >
                                    <FaCarSide />
                                </button>
                            </div>
                        </div>
                        <div className={styles.mapContainer}>
                        {uploadedData ? (
                            <div className={styles.svgContainer}>
                                <div 
                                    className={`${styles.svgWrapper} 
                                        ${isDrawingMode ? styles.drawingMode : ''} 
                                        ${isRemovingMode ? styles.removingMode : ''}`}
                                    onClick={handleMapClick}
                                    onMouseMove={handleMapMouseMove}
                                    dangerouslySetInnerHTML={{ __html: uploadedData.svgContent }} 
                                />
                                {tempRoad && (
                                    <svg 
                                        style={{ 
                                            position: 'absolute', 
                                            top: 0, 
                                            left: 0, 
                                            width: '100%', 
                                            height: '100%', 
                                            pointerEvents: 'none' 
                                        }}
                                        viewBox="0 0 1600 1200"
                                    >
                                        <path
                                            d={`M${tempRoad.start.x},${tempRoad.start.y} L${tempRoad.end.x},${tempRoad.end.y}`}
                                            stroke="#2c3e50"
                                            strokeWidth="45"
                                            strokeLinecap="round"
                                            fill="none"
                                            opacity="0.5"
                                        />
                                    </svg>
                                )}
                            </div>
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

export default UploadMap;
