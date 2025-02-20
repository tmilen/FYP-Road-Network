import React from 'react';
import Navbar from './navbar';
import styles from '../css/uploadmap.module.css';
import useUploadMap from '../components/uploadmap';
import { RiFileUploadLine } from "react-icons/ri";
import { BsFiletypeXml } from "react-icons/bs";
import { FaRoad, FaTrash } from 'react-icons/fa';  // Add this import
import { useNavigate } from 'react-router-dom';
import { FaArrowLeftLong } from "react-icons/fa6";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { FaTrafficLight } from 'react-icons/fa';
import { MdOutlineCleaningServices } from "react-icons/md";
import { MdOutlineSmartDisplay } from "react-icons/md";
import { MdDeleteOutline } from "react-icons/md";
import { VscEdit } from "react-icons/vsc"; 

function UploadMap() {
    const navigate = useNavigate();
    const {
        selectedFile,
        uploadMessage,
        handleRemoveRoadClick,
        handleFileChange,
        handleFileUpload,
        uploadedData,
        mapsList,
        selectedMap,
        setSelectedMap,
        handleDisplayMap,
        handleDeleteMap,
        handleClearMap,
        isDrawingMode,
        handleAddRoadClick,
        handleMapClick,
        handleMapMouseMove,
        isRemovingMode,
        isSignalMode,
        handleAddSignalClick,
        isEditMode,
        handleEditModeClick,
        isSimulating,
        toggleTrafficSimulation,
    } = useUploadMap();

    return (
        <div className={styles.pageContainer}>
            <button 
                className={styles.modernBackButton}
                onClick={() => navigate('/traffic-management')}
            >
                <FaArrowLeftLong className={styles.backArrow} />
                <span className={styles.backText}>Back to Traffic Management</span>
            </button>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />
            <div className={styles.navbarGap}></div>
            
            <div className={styles.mainContainer}>
                <div className={styles.controlPanel}>
                    {/* Map Upload Container */}
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
                                    < MdOutlineSmartDisplay className={styles.displayIcon} />
                                </button>
                                <button 
                                    className={`${styles.displayButton} ${styles.deleteButton}`}
                                    onClick={handleDeleteMap}
                                    disabled={!selectedMap}
                                >
                                    <MdDeleteOutline className={styles.displayIcon} />
                                </button>
                            </div>
                            
                            
                        </div>

                        {uploadMessage && (
                            <div className={uploadMessage.includes('successfully') ? styles.successMessage : styles.errorMessage}>
                                {uploadMessage}
                            </div>
                        )}
                    </div>

                    {/* Add new simulation control box */}
                    <div className={styles.simulationControlCard}>
                        <h3>Simulation Controls</h3>
                        <div className={styles.simulationControls}>
                            <button
                                className={`${styles.simulationButton} ${isSimulating ? styles.active : ''}`}
                                onClick={toggleTrafficSimulation}
                                disabled={!selectedMap}
                            >
                                {isSimulating ? 'Stop Simulation' : 'Start Simulation'}
                            </button>
                            {isSimulating && (
                                <span className={styles.simulationStatus}>
                                    Simulation running...
                                </span>
                            )}
                        </div>
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
                                    className={`${styles.mapControlButton} ${styles.editButton} ${isEditMode ? styles.active : ''}`}
                                    onClick={handleEditModeClick}
                                    disabled={!uploadedData}
                                >
                                    <VscEdit />
                                </button>
                                {/* Only show these buttons when edit mode is active */}
                                {isEditMode && (
                                    <>
                                        <button
                                            className={`${styles.mapControlButton} ${styles.addSignal} ${isSignalMode ? styles.active : ''}`}
                                            onClick={handleAddSignalClick}
                                            disabled={!isEditMode}
                                            title="Add Traffic Signal"
                                        >
                                            <FaTrafficLight />
                                        </button>
                                        <button 
                                            className={`${styles.mapControlButton} ${styles.addRoad} ${isDrawingMode ? styles.active : ''}`}
                                            onClick={handleAddRoadClick}
                                            disabled={!uploadedData}
                                            title="Add Road"
                                        >
                                            <FaRoad />
                                        </button>
                                        <button 
                                            className={`${styles.mapControlButton} ${styles.removeRoad} ${isRemovingMode ? styles.active : ''}`}
                                            onClick={handleRemoveRoadClick}
                                            disabled={!uploadedData}
                                            title="Remove Road"
                                        >
                                            <FaTrash />
                                        </button>
                                    </>
                                )}
                                <button 
                                    className={`${styles.mapControlButton} ${styles.clearButton}`}
                                    onClick={handleClearMap}
                                    disabled={!uploadedData}
                                >
                                    <MdOutlineCleaningServices />
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
            <ToastContainer 
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
        </div>
    );
}

export default UploadMap;
