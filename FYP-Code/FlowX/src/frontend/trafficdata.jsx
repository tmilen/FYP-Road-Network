import React, { useState, useEffect } from 'react';
import Navbar from './navbar';
import styles from '../css/trafficdata.module.css';
import { FaSearch, FaFilter, FaDownload, FaTimes, FaSlidersH } from 'react-icons/fa';
import useTrafficData from '../components/trafficdata';

function TrafficData() {
    const [selectedRoad, setSelectedRoad] = useState(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showHistoricalFilterModal, setShowHistoricalFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        conditions: []  // Add this new state
    });
    const [historicalFilters, setHistoricalFilters] = useState({
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        conditions: []  // Add this new state
    });
    const {
        trafficData,
        loading,
        error,
        searchTerm,
        setSearchTerm,
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
        }).split('/').join('-');  // Convert / to -
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
            loading: true,
            historicalData: []
        });
        
        try {
            const response = await fetchHistoricalDataForRoad(roadId);
            setSelectedRoad(prev => ({
                ...prev,
                historicalData: response.data || [], // Ensure we have an array
                loading: false
            }));
        } catch (error) {
            console.error('Error loading historical data:', error);
            setSelectedRoad(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to load historical data',
                historicalData: [] // Ensure we have an array even on error
            }));
        }
    };

    const closeModal = () => {
        setSelectedRoad(null);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleFilterClick = () => {
        setShowFilterModal(true);
    };

    const handleFilterClose = () => {
        setShowFilterModal(false);
    };

    const handleFilterApply = () => {
        fetchTrafficData(filters);
        setShowFilterModal(false);
    };

    const handleFilterReset = () => {
        setFilters({
            startDate: '',
            endDate: '',
            startTime: '',
            endTime: '',
            conditions: []  // Add this new state
        });
        fetchTrafficData();
        setShowFilterModal(false);
    };

    const handleHistoricalFilterClick = () => {
        setShowHistoricalFilterModal(true);
    };

    const handleHistoricalFilterClose = () => {
        setShowHistoricalFilterModal(false);
    };

    const handleHistoricalFilterApply = async () => {
        if (selectedRoad) {
            try {
                const response = await fetchHistoricalDataForRoad(selectedRoad.id, historicalFilters);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: response.data || [], // Ensure we have an array
                }));
                setShowHistoricalFilterModal(false);
            } catch (error) {
                console.error('Error applying historical filters:', error);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: [], // Ensure we have an array on error
                }));
            }
        }
    };

    const handleHistoricalFilterReset = async () => {
        setHistoricalFilters({
            startDate: '',
            endDate: '',
            startTime: '',
            endTime: '',
            conditions: []  // Add this new state
        });
        if (selectedRoad) {
            try {
                const response = await fetchHistoricalDataForRoad(selectedRoad.id);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: response.data || [], // Ensure we have an array
                }));
            } catch (error) {
                console.error('Error resetting historical data:', error);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: [], // Ensure we have an array on error
                }));
            }
        }
    };

    const renderFilterConditions = (currentFilters, setCurrentFilters) => (
        <div className={styles.filterGroup}>
            <label>Traffic Conditions</label>
            <div className={styles.conditionCheckboxes}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={currentFilters.conditions.includes('low')}
                        onChange={(e) => {
                            const newConditions = e.target.checked
                                ? [...currentFilters.conditions, 'low']
                                : currentFilters.conditions.filter(c => c !== 'low');
                            setCurrentFilters({...currentFilters, conditions: newConditions});
                        }}
                    />
                    Light
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={currentFilters.conditions.includes('medium')}
                        onChange={(e) => {
                            const newConditions = e.target.checked
                                ? [...currentFilters.conditions, 'medium']
                                : currentFilters.conditions.filter(c => c !== 'medium');
                            setCurrentFilters({...currentFilters, conditions: newConditions});
                        }}
                    />
                    Moderate
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={currentFilters.conditions.includes('high')}
                        onChange={(e) => {
                            const newConditions = e.target.checked
                                ? [...currentFilters.conditions, 'high']
                                : currentFilters.conditions.filter(c => c !== 'high');
                            setCurrentFilters({...currentFilters, conditions: newConditions});
                        }}
                    />
                    Heavy
                </label>
            </div>
        </div>
    );

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
                                placeholder="Search roads..."
                                value={searchTerm}
                                onChange={handleSearchChange}
                            />
                        </div>
                        <button className={styles.controlButton} onClick={handleFilterClick}>
                            <FaFilter /> Filter
                        </button>
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
                                <th>Accidents</th>
                                <th>Congestion</th>
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
                                    <td className={data.accidentCount > 0 ? styles.warningCount : ''}>
                                        {data.accidentCount}
                                    </td>
                                    <td className={data.congestionCount > 0 ? styles.warningCount : ''}>
                                        {data.congestionCount}
                                    </td>
                                </tr>
                            ))}
                            {trafficData.length === 0 && (
                                <tr>
                                    <td colSpan="9" className={styles.noData}>
                                        No traffic data available
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Filter Modal */}
                {showFilterModal && (
                    <div className={styles.modal}>
                        <div className={`${styles.modalContent} ${styles.filterModal}`}>
                            <div className={styles.modalHeader}>
                                <h3>Filter Traffic Data</h3>
                                <button className={styles.closeButton} onClick={handleFilterClose}>
                                    <FaTimes />
                                </button>
                            </div>
                            <div className={styles.filterContent}>
                                <div className={styles.filterGroup}>
                                    <label>Date Range</label>
                                    <div className={styles.dateInputs}>
                                        <input
                                            type="date"
                                            value={filters.startDate}
                                            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                                        />
                                        <span>to</span>
                                        <input
                                            type="date"
                                            value={filters.endDate}
                                            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                                        />
                                    </div>
                                </div>
                                <div className={styles.filterGroup}>
                                    <label>Time Range</label>
                                    <div className={styles.timeInputs}>
                                        <input
                                            type="time"
                                            value={filters.startTime}
                                            onChange={(e) => setFilters({...filters, startTime: e.target.value})}
                                        />
                                        <span>to</span>
                                        <input
                                            type="time"
                                            value={filters.endTime}
                                            onChange={(e) => setFilters({...filters, endTime: e.target.value})}
                                        />
                                    </div>
                                </div>
                                {renderFilterConditions(filters, setFilters)}
                                <div className={styles.filterActions}>
                                    <button className={styles.applyButton} onClick={handleFilterApply}>
                                        Apply Filters
                                    </button>
                                    <button className={styles.resetButton} onClick={handleFilterReset}>
                                        Reset Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Historical Data Modal */}
                {selectedRoad && (
                    <div className={styles.modal}>
                        <div className={styles.modalContent}>
                            <div className={styles.modalHeader}>
                                <h3>Historical Data for {selectedRoad.name}</h3>
                                <div className={styles.modalControls}>
                                    <button className={styles.filterButton} onClick={handleHistoricalFilterClick}>
                                        <FaFilter /> Filter
                                    </button>
                                    <button className={styles.closeButton} onClick={closeModal}>
                                        <FaTimes />
                                    </button>
                                </div>
                            </div>

                            {/* Add incident summary section */}
                            <div className={styles.incidentSummary}>
                                <div className={styles.incidentCounter}>
                                    <span className={styles.label}>Total Accidents:</span>
                                    <span className={styles.count}>
                                        {selectedRoad.historicalData?.reduce((total, record) => total + (record.accidentCount || 0), 0)}
                                    </span>
                                </div>
                                <div className={styles.incidentCounter}>
                                    <span className={styles.label}>Total Congestion:</span>
                                    <span className={styles.count}>
                                        {selectedRoad.historicalData?.reduce((total, record) => total + (record.congestionCount || 0), 0)}
                                    </span>
                                </div>
                            </div>

                            {showHistoricalFilterModal && (
                                <div className={styles.filterSection}>
                                    <div className={styles.filterGroup}>
                                        <label>Date Range</label>
                                        <div className={styles.dateInputs}>
                                            <input
                                                type="date"
                                                value={historicalFilters.startDate}
                                                onChange={(e) => setHistoricalFilters({
                                                    ...historicalFilters,
                                                    startDate: e.target.value
                                                })}
                                            />
                                            <span>to</span>
                                            <input
                                                type="date"
                                                value={historicalFilters.endDate}
                                                onChange={(e) => setHistoricalFilters({
                                                    ...historicalFilters,
                                                    endDate: e.target.value
                                                })}
                                            />
                                        </div>
                                    </div>
                                    <div className={styles.filterGroup}>
                                        <label>Time Range</label>
                                        <div className={styles.timeInputs}>
                                            <input
                                                type="time"
                                                value={historicalFilters.startTime}
                                                onChange={(e) => setHistoricalFilters({
                                                    ...historicalFilters,
                                                    startTime: e.target.value
                                                })}
                                            />
                                            <span>to</span>
                                            <input
                                                type="time"
                                                value={historicalFilters.endTime}
                                                onChange={(e) => setHistoricalFilters({
                                                    ...historicalFilters,
                                                    endTime: e.target.value
                                                })}
                                            />
                                        </div>
                                    </div>
                                    {renderFilterConditions(historicalFilters, setHistoricalFilters)}
                                    <div className={styles.filterActions}>
                                        <button className={styles.applyButton} onClick={handleHistoricalFilterApply}>
                                            Apply Filters
                                        </button>
                                        <button className={styles.resetButton} onClick={handleHistoricalFilterReset}>
                                            Reset Filters
                                        </button>
                                    </div>
                                </div>
                            )}
                            {selectedRoad.loading ? (
                                <div className={styles.loading}>Loading historical data...</div>
                            ) : selectedRoad.error ? (
                                <div className={styles.error}>{selectedRoad.error}</div>
                            ) : selectedRoad.historicalData?.length === 0 ? (
                                <div className={styles.noData}>No historical data available</div>
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
                                                <th>Accidents</th>
                                                <th>Congestion</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedRoad.historicalData?.map((record, index) => (
                                                <tr key={`${record.timestamp}-${index}`}>
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
                                                    <td className={record.accidentCount > 0 ? styles.warningCount : ''}>
                                                        {record.accidentCount}
                                                    </td>
                                                    <td className={record.congestionCount > 0 ? styles.warningCount : ''}>
                                                        {record.congestionCount}
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
            </div>
        </div>
    );
}

export default TrafficData;
