import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from './navbar';
import styles from '../css/trafficdata.module.css';
import { FaSearch, FaFilter, FaDownload, FaTimes, FaSlidersH } from 'react-icons/fa';
import { FaArrowLeftLong } from "react-icons/fa6";
import useTrafficData from '../components/trafficdata';

function TrafficData() {
    const navigate = useNavigate();
    const [selectedRoad, setSelectedRoad] = useState(null);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [showHistoricalFilterModal, setShowHistoricalFilterModal] = useState(false);
    const [filters, setFilters] = useState({
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        conditions: []
    });
    const [historicalFilters, setHistoricalFilters] = useState({
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        conditions: []
    });
    const [availableRanges, setAvailableRanges] = useState({
        dateRange: { start: '', end: '' },
        timeRange: { start: '', end: '' }
    });
    const [timeError, setTimeError] = useState('');
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

    const modalRef = useRef(null);

    const handleModalClick = (e) => {
        if (e.target.className === styles.modal) {
            closeModal();
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatDateForInput = (dateString) => {
        if (!dateString) return '';
        // If already in YYYY-MM-DD format, return as is
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) return dateString;
        // If in DD-MM-YYYY format, convert to YYYY-MM-DD
        const [day, month, year] = dateString.split('-');
        return `${year}-${month}-${day}`;
    };

    const formatDateForAPI = (dateString) => {
        if (!dateString) return '';
        // Convert from YYYY-MM-DD to DD-MM-YYYY
        const [year, month, day] = dateString.split('-');
        return `${day}-${month}-${year}`;
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    useEffect(() => {
        const fetchAvailableRanges = async () => {
            try {
                const response = await fetch(`${process.env.REACT_APP_API_URL}/traffic/available-ranges`);
                const data = await response.json();
                setAvailableRanges(data);
            } catch (error) {
                console.error('Error fetching available ranges:', error);
            }
        };

        fetchAvailableRanges();
        fetchTrafficData();
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
                historicalData: response.data || [],
                loading: false
            }));
        } catch (error) {
            console.error('Error loading historical data:', error);
            setSelectedRoad(prev => ({
                ...prev,
                loading: false,
                error: 'Failed to load historical data',
                historicalData: []
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
            conditions: []
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
                    historicalData: response.data || [],
                }));
                setShowHistoricalFilterModal(false);
            } catch (error) {
                console.error('Error applying historical filters:', error);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: [],
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
            conditions: []
        });
        if (selectedRoad) {
            try {
                const response = await fetchHistoricalDataForRoad(selectedRoad.id);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: response.data || [],
                }));
            } catch (error) {
                console.error('Error resetting historical data:', error);
                setSelectedRoad(prev => ({
                    ...prev,
                    historicalData: [],
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

    const handleTimeChange = (currentFilters, setFilters, type, value) => {
        if (type === 'start') {
            // When changing start time
            if (currentFilters.endTime && value > currentFilters.endTime) {
                setTimeError('Start time cannot be later than end time');
            } else {
                setTimeError('');
            }
            setFilters({...currentFilters, startTime: value});
        } else {
            // When changing end time
            if (value < currentFilters.startTime) {
                setTimeError('End time cannot be earlier than start time');
            } else {
                setTimeError('');
            }
            setFilters({...currentFilters, endTime: value});
        }
    };

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
                                            value={formatDateForInput(filters.startDate)}
                                            min={formatDateForInput(availableRanges.dateRange.start)}
                                            max={formatDateForInput(availableRanges.dateRange.end)}
                                            onChange={(e) => setFilters({
                                                ...filters, 
                                                startDate: formatDateForAPI(e.target.value)
                                            })}
                                        />
                                        <span>to</span>
                                        <input
                                            type="date"
                                            value={formatDateForInput(filters.endDate)}
                                            min={formatDateForInput(filters.startDate || availableRanges.dateRange.start)}
                                            max={formatDateForInput(availableRanges.dateRange.end)}
                                            onChange={(e) => setFilters({
                                                ...filters, 
                                                endDate: formatDateForAPI(e.target.value)
                                            })}
                                        />
                                    </div>
                                </div>
                                <div className={styles.filterGroup}>
                                    <label>Time Range</label>
                                    <div className={styles.timeInputs}>
                                        <input
                                            type="time"
                                            value={filters.startTime}
                                            min={availableRanges.timeRange.start}
                                            max={availableRanges.timeRange.end}
                                            onChange={(e) => handleTimeChange(filters, setFilters, 'start', e.target.value)}
                                        />
                                        <span>to</span>
                                        <input
                                            type="time"
                                            value={filters.endTime}
                                            min={filters.startTime || availableRanges.timeRange.start}
                                            max={availableRanges.timeRange.end}
                                            onChange={(e) => handleTimeChange(filters, setFilters, 'end', e.target.value)}
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

                {selectedRoad && (
                    <div className={styles.modal} onClick={handleModalClick}>
                        <div className={styles.modalContent} ref={modalRef}>
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

                            <div className={styles.incidentSummary}>
                                <div className={selectedRoad.historicalData.some(record => record.accidentCount > 0) ? 
                                     `${styles.incidentCounter} ${styles.warning}` : styles.incidentCounter}>
                                    <span className={styles.label}>Total Accidents:</span>
                                    <span className={styles.count}>
                                        {selectedRoad.historicalData.reduce((sum, record) => sum + record.accidentCount, 0)}
                                    </span>
                                </div>
                                <div className={selectedRoad.historicalData.some(record => record.congestionCount > 0) ? 
                                     `${styles.incidentCounter} ${styles.warning}` : styles.incidentCounter}>
                                    <span className={styles.label}>Total Congestion Events:</span>
                                    <span className={styles.count}>
                                        {selectedRoad.historicalData.reduce((sum, record) => sum + record.congestionCount, 0)}
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
                                                value={formatDateForInput(historicalFilters.startDate)}
                                                min={formatDateForInput(availableRanges.dateRange.start)}
                                                max={formatDateForInput(availableRanges.dateRange.end)}
                                                onChange={(e) => setHistoricalFilters({
                                                    ...historicalFilters,
                                                    startDate: formatDateForAPI(e.target.value)
                                                })}
                                            />
                                            <span>to</span>
                                            <input
                                                type="date"
                                                value={formatDateForInput(historicalFilters.endDate)}
                                                min={formatDateForInput(historicalFilters.startDate || availableRanges.dateRange.start)}
                                                max={formatDateForInput(availableRanges.dateRange.end)}
                                                onChange={(e) => setHistoricalFilters({
                                                    ...historicalFilters,
                                                    endDate: formatDateForAPI(e.target.value)
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
                                                min={availableRanges.timeRange.start}
                                                max={availableRanges.timeRange.end}
                                                onChange={(e) => handleTimeChange(historicalFilters, setHistoricalFilters, 'start', e.target.value)}
                                                className={styles.filterInput}
                                            />
                                            <span>to</span>
                                            <input
                                                type="time"
                                                value={historicalFilters.endTime}
                                                min={historicalFilters.startTime || availableRanges.timeRange.start}
                                                max={availableRanges.timeRange.end}
                                                onChange={(e) => handleTimeChange(historicalFilters, setHistoricalFilters, 'end', e.target.value)}
                                                className={styles.filterInput}
                                                disabled={!historicalFilters.startTime} // Disable end time input until start time is selected
                                            />
                                        </div>
                                        {timeError && <div className={styles.errorMessage}>{timeError}</div>}
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
