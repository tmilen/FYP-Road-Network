import React, { useState, useEffect } from 'react';
import Navbar from './navbar';
import styles from '../css/trafficdata.module.css';
import { FaSearch, FaFilter, FaDownload, FaTimes, FaSlidersH } from 'react-icons/fa';
import useTrafficData from '../components/trafficdata';

function TrafficData() {
    const [selectedRoad, setSelectedRoad] = useState(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [filterOptions, setFilterOptions] = useState({
        intensity: 'all',
        minSpeed: '',
        maxSpeed: '',
        date: '',
        startTime: '',
        endTime: ''
    });
    const {
        trafficData,
        loading,
        error,
        searchTerm,
        setSearchTerm,
        handleFilter,
        handleExport,
        fetchTrafficData,
        fetchHistoricalDataForRoad
    } = useTrafficData();

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    useEffect(() => {
        fetchTrafficData();  // Only fetch current traffic data initially
    }, []);

    const handleRoadClick = async (roadId, roadName) => {
        setSelectedRoad({
            id: roadId,
            name: roadName,
            loading: true
        });
        const data = await fetchHistoricalDataForRoad(roadId);
        setSelectedRoad(prev => ({
            ...prev,
            historicalData: data,
            loading: false
        }));
    };

    const closeModal = () => {
        setSelectedRoad(null);
    };

    const clearFilters = () => {
        setFilterOptions({
            intensity: 'all',
            minSpeed: '',
            maxSpeed: '',
            date: '',
            startTime: '',
            endTime: ''
        });
        handleFilter({
            intensity: 'all',
            minSpeed: '',
            maxSpeed: '',
            date: '',
            startTime: '',
            endTime: ''
        });
    };

    const FilterModal = ({ onClose, onApply, currentFilters }) => {
        const [localFilters, setLocalFilters] = useState(currentFilters);
    
        return (
            <div className={styles.modal}>
                <div className={`${styles.modalContent} ${styles.filterModal}`}>
                    <div className={styles.modalHeader}>
                        <h3>Filter Traffic Data</h3>
                        <button className={styles.closeButton} onClick={onClose}>
                            <FaTimes />
                        </button>
                    </div>
                    <div className={styles.filterContent}>
                        <div className={styles.filterGroup}>
                            <label>Traffic Intensity:</label>
                            <select 
                                value={localFilters.intensity}
                                onChange={(e) => setLocalFilters({...localFilters, intensity: e.target.value})}
                            >
                                <option value="all">All</option>
                                <option value="low">Light</option>
                                <option value="medium">Moderate</option>
                                <option value="high">Heavy</option>
                            </select>
                        </div>
                        
                        <div className={styles.filterGroup}>
                            <label>Speed Range (km/h):</label>
                            <div className={styles.speedInputs}>
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={localFilters.minSpeed}
                                    onChange={(e) => setLocalFilters({...localFilters, minSpeed: e.target.value})}
                                />
                                <span>to</span>
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={localFilters.maxSpeed}
                                    onChange={(e) => setLocalFilters({...localFilters, maxSpeed: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className={styles.filterGroup}>
                            <label>Date:</label>
                            <input
                                type="date"
                                value={localFilters.date}
                                onChange={(e) => setLocalFilters({...localFilters, date: e.target.value})}
                            />
                        </div>

                        <div className={styles.filterGroup}>
                            <label>Time Range:</label>
                            <div className={styles.timeInputs}>
                                <input
                                    type="time"
                                    value={localFilters.startTime}
                                    onChange={(e) => setLocalFilters({...localFilters, startTime: e.target.value})}
                                />
                                <span>to</span>
                                <input
                                    type="time"
                                    value={localFilters.endTime}
                                    onChange={(e) => setLocalFilters({...localFilters, endTime: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className={styles.filterActions}>
                            <button 
                                className={styles.applyButton} 
                                onClick={() => onApply(localFilters)}
                            >
                                Apply Filters
                            </button>
                            <button 
                                className={styles.clearButton}
                                onClick={() => {
                                    const clearedFilters = {
                                        intensity: 'all',
                                        minSpeed: '',
                                        maxSpeed: '',
                                        date: '',
                                        startTime: '',
                                        endTime: ''
                                    };
                                    setLocalFilters(clearedFilters);
                                    onApply(clearedFilters);
                                }}
                            >
                                Clear All
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) return <div className={styles.loading}>Loading traffic data...</div>;
    if (error) return <div className={styles.error}>{error}</div>;

    return (
        <div className={styles.pageContainer}>
            <h1 className={styles.title}>FlowX</h1>
            <Navbar sticky={false} />
            <div className={styles.navbarGap}></div>

            <div className={styles.contentContainer}>
                <div className={styles.headerSection}>
                    <h2 className={styles.subtitle}>Traffic Data Analysis</h2>
                    <div className={styles.controls}>
                        <div className={styles.searchBar}>
                            <FaSearch className={styles.searchIcon} />
                            <input 
                                type="text"
                                placeholder="Search streets..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className={`${styles.controlButton} ${filterOptions.intensity !== 'all' || filterOptions.minSpeed || filterOptions.maxSpeed || filterOptions.date || filterOptions.startTime || filterOptions.endTime ? styles.active : ''}`} 
                            onClick={() => setShowFilterModal(true)}>
                            <FaFilter /> Filter
                        </button>
                        {(filterOptions.intensity !== 'all' || filterOptions.minSpeed || filterOptions.maxSpeed || filterOptions.date || filterOptions.startTime || filterOptions.endTime) && (
                            <button 
                                className={styles.clearButton}
                                onClick={clearFilters}
                            >
                                Clear Filters
                            </button>
                        )}
                        <button 
                            className={styles.controlButton} 
                            onClick={() => handleExport(trafficData)}
                        >
                            <FaDownload /> Export
                        </button>
                        <button 
                            className={styles.refreshButton}
                            onClick={fetchTrafficData}
                        >
                            Refresh
                        </button>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>No.</th>
                                <th>Street Name</th>
                                <th>Date</th>
                                <th>Time</th>
                                <th>Current Speed</th>
                                <th>Free Flow Speed</th>
                                <th>Traffic Condition</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trafficData.map((data, index) => (
                                <tr key={`${data.road_id}-${data.lastUpdated}`}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <button 
                                            className={styles.roadLink}
                                            onClick={() => handleRoadClick(data.road_id, data.streetName)}
                                            title="Click to view historical data"
                                        >
                                            {data.streetName}
                                        </button>
                                    </td>
                                    <td>{formatDate(data.lastUpdated)}</td>
                                    <td>{formatTime(data.lastUpdated)}</td>
                                    <td>{Math.round(data.currentSpeed)} km/h</td>
                                    <td>{Math.round(data.freeFlowSpeed)} km/h</td>
                                    <td>
                                        <span className={`${styles.badge} ${styles[data.intensity]}`}>
                                            {data.intensity === 'low' ? 'Light' : 
                                             data.intensity === 'medium' ? 'Moderate' : 'Heavy'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {trafficData.length === 0 && (
                                <tr>
                                    <td colSpan="7" className={styles.noData}>
                                        No traffic data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Historical Data Modal */}
                {selectedRoad && (
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h3>Historical Data for {selectedRoad.name}</h3>
                                <button className={styles.closeButton} onClick={closeModal}>
                                    <FaTimes />
                                </button>
                            </div>
                            {selectedRoad.loading ? (
                                <div className={styles.loading}>Loading historical data...</div>
                            ) : (
                                <div className={styles.historicalData}>
                                    <table className={styles.dataTable}>
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Time</th>
                                                <th>Speed</th>
                                                <th>Free Flow</th>
                                                <th>Condition</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRoad.historicalData?.map((record) => (
                                                <tr key={record.timestamp}>
                                                    <td>{formatDate(record.timestamp)}</td>
                                                    <td>{formatTime(record.timestamp)}</td>
                                                    <td>{Math.round(record.currentSpeed)} km/h</td>
                                                    <td>{Math.round(record.freeFlowSpeed)} km/h</td>
                                                    <td>
                                                        <span className={`${styles.badge} ${styles[record.intensity]}`}>
                                                            {record.intensity === 'low' ? 'Light' : 
                                                             record.intensity === 'medium' ? 'Moderate' : 'Heavy'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Filter Modal */}
                {showFilterModal && (
                    <FilterModal
                        onClose={() => setShowFilterModal(false)}
                        onApply={(newFilters) => {
                            handleFilter(newFilters);
                            setFilterOptions(newFilters);
                            setShowFilterModal(false);
                        }}
                        currentFilters={filterOptions}
                    />
                )}
            </div>
        </div>
    );
}

export default TrafficData;
