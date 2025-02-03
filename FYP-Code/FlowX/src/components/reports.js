import { useState, useEffect } from 'react';
import { FaFilePdf, FaChartLine, FaList } from 'react-icons/fa';
import axios from 'axios';
import { toast, Bounce } from 'react-toastify';

// Toast configuration
const toastConfig = {
    position: "top-right",
    autoClose: 5000,
    hideProgressBar: false,
    closeOnClick: false,
    pauseOnHover: true,
    draggable: true,
    progress: undefined,
    theme: "light",
    transition: Bounce,
};

export const useReportsController = () => {
    const [selectedReport, setSelectedReport] = useState(null);
    const [isMenuExpanded, setIsMenuExpanded] = useState(false);

    const reportTypes = [
        { 
            id: 'standard',
            title: 'Standard Reports', 
            icon: <FaFilePdf />,
            description: 'Export traffic data to PDF format'
        },
        { 
            id: 'view-reports',  // New option
            title: 'View Reports',
            icon: <FaList />,
            description: 'View and manage generated reports'
        },
        { 
            id: 'traffic-analysis',
            title: 'Traffic Analysis', 
            icon: <FaChartLine />,
            description: 'Visualize traffic patterns and trends over time'
        }
    ];

    return {
        selectedReport,
        setSelectedReport,
        isMenuExpanded,
        setIsMenuExpanded,
        reportTypes
    };
};

export const useStandardReportController = () => {
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [timeRange, setTimeRange] = useState({ start: '', end: '' });
    const [selectedRoads, setSelectedRoads] = useState([]);
    const [dataType, setDataType] = useState('traffic');
    const [showRoadSelector, setShowRoadSelector] = useState(false);
    const [availableRoads, setAvailableRoads] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [availableRanges, setAvailableRanges] = useState({
        dateRange: { start: '', end: '' },
        timeRange: { start: '', end: '' }
    });
    const [previewData, setPreviewData] = useState(null);

    const fetchAvailableRoads = async () => {
        try {
            // Modified API endpoint to get unique roads list
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/traffic/roads`);

            if (response.status === 200 && response.data) {
                console.log('Available roads:', response.data);
                setAvailableRoads(response.data);
            }
        } catch (error) {
            console.error('Error fetching roads:', error);
            setAvailableRoads([]);
        }
    };

    const fetchAvailableRanges = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/traffic/available-ranges`);
            if (response.status === 200) {
                // Convert DD-MM-YYYY to YYYY-MM-DD for input fields
                const { dateRange, timeRange } = response.data;
                const convertDate = (dateStr) => {
                    const [day, month, year] = dateStr.split('-');
                    return `${year}-${month}-${day}`;
                };

                setAvailableRanges({
                    dateRange: {
                        start: convertDate(dateRange.start),
                        end: convertDate(dateRange.end)
                    },
                    timeRange: timeRange
                });
            }
        } catch (error) {
            console.error('Error fetching available ranges:', error);
        }
    };

    // Call fetchAvailableRoads and fetchAvailableRanges immediately when component mounts
    useEffect(() => {
        fetchAvailableRanges();
        fetchAvailableRoads();
    }, []);

    const handleRoadToggle = (road) => {
        setSelectedRoads(prev => 
            prev.includes(road)
                ? prev.filter(r => r !== road)
                : [...prev, road]
        );
    };

    // New validation system
    const validateField = (field, value) => {
        switch (field) {
            case 'dateRange':
                if (!value.start && !value.end) return true; // Optional field
                if (value.start && !value.end) return 'End date is required when start date is set';
                if (!value.start && value.end) return 'Start date is required when end date is set';
                if (value.start > value.end) return 'Start date cannot be after end date';
                return true;

            case 'timeRange':
                if (!value.start && !value.end) return true; // Optional field
                if (value.start && !value.end) return 'End time is required when start time is set';
                if (!value.start && value.end) return 'Start time is required when end time is set';
                if (value.start > value.end) return 'Start time cannot be after end time';
                return true;

            case 'selectedRoads':
                if (!value.length) return true; // Optional field
                if (value.length > 5) return 'Maximum 5 roads can be selected';
                return true;

            default:
                return true;
        }
    };

    const validateAllFields = () => {
        const errors = [];

        // Validate individual fields
        const dateRangeValidation = validateField('dateRange', dateRange);
        if (dateRangeValidation !== true) errors.push(dateRangeValidation);

        const timeRangeValidation = validateField('timeRange', timeRange);
        if (timeRangeValidation !== true) errors.push(timeRangeValidation);

        const roadsValidation = validateField('selectedRoads', selectedRoads);
        if (roadsValidation !== true) errors.push(roadsValidation);

        // Validate field dependencies
        const hasDateRange = dateRange.start && dateRange.end;
        const hasTimeRange = timeRange.start && timeRange.end;
        const hasRoads = selectedRoads.length > 0;

        if (!hasDateRange && !hasTimeRange && !hasRoads) {
            errors.push('At least one filter (Date Range, Time Range, or Roads) must be selected');
        }

        if ((hasDateRange && !hasTimeRange) || (!hasDateRange && hasTimeRange)) {
            errors.push('Both date range and time range must be set together');
        }

        return errors;
    };

    const handleGenerateReport = async () => {
        const validationErrors = validateAllFields();
        if (validationErrors.length > 0) {
            validationErrors.forEach(error => toast.error(error, toastConfig));
            return false;
        }

        setIsGenerating(true);
        try {
            const reportData = {
                dataType,
                dateRange: dateRange.start && dateRange.end ? dateRange : null,
                timeRange: timeRange.start && timeRange.end ? timeRange : null,
                selectedRoads: selectedRoads.length > 0 ? selectedRoads : null,
                includeIncidents: dataType === 'incidents' || dataType === 'comprehensive',
                metadata: {
                    generatedAt: new Date().toISOString(),
                    reportType: 'standard'
                }
            };

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/reports`, 
                reportData,
                {
                    responseType: 'blob',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `traffic-report-${new Date().toISOString()}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Report generated successfully.', toastConfig);
                return true;
            }
            return false;
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Error generating report. Please try again.';
            toast.error(errorMessage, toastConfig);
            return false;
        } finally {
            setIsGenerating(false);
        }
    };

    const generatePreview = async () => {
        try {
            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/reports/preview`, 
                {
                    dataType,
                    dateRange: dateRange.start && dateRange.end ? dateRange : null,
                    timeRange: timeRange.start && timeRange.end ? timeRange : null,
                    selectedRoads: selectedRoads.length > 0 ? selectedRoads : null,
                },
                {
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                setPreviewData(response.data);
            }
        } catch (error) {
            setPreviewData(null);
            toast.error('Error generating preview', toastConfig);
        }
    };

    // Call preview generation when filters change
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (dateRange.start || dateRange.end || timeRange.start || timeRange.end || selectedRoads.length > 0) {
                generatePreview();
            }
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [dateRange, timeRange, selectedRoads, dataType]);

    const getFilteredRoads = () => {
        console.log('Available roads:', availableRoads);
        console.log('Search term:', searchTerm);
        const filtered = availableRoads.filter(road =>
            road.toLowerCase().includes(searchTerm.toLowerCase())
        );
        console.log('Filtered roads:', filtered);
        return filtered;
    };

    const formatColumnName = (column) => {
        switch(column) {
            case 'streetName':
                return 'Street Name';
            case 'currentSpeed':
                return 'Current Speed (km/h)';
            case 'freeFlowSpeed':
                return 'Free Flow Speed (km/h)';
            case 'accidentCount':
                return 'Accidents';
            case 'congestionCount':
                return 'Congestion Events';
            case 'intensity':
                return 'Traffic Condition';
            default:
                return column.charAt(0).toUpperCase() + 
                       column.slice(1).replace(/([A-Z])/g, ' $1');
        }
    };

    const handleTimeChange = (type, value) => {
        if (type === 'start') {
            // If end time exists and is earlier than new start time, reset end time
            if (timeRange.end && value > timeRange.end) {
                setTimeRange({ start: value, end: '' });
            } else {
                setTimeRange({ ...timeRange, start: value });
            }
        } else {
            // Only allow end time to be set if it's later than start time
            if (!timeRange.start || value >= timeRange.start) {
                setTimeRange({ ...timeRange, end: value });
            }
        }
    };

    return {
        dateRange,
        setDateRange,
        timeRange,
        setTimeRange,
        selectedRoads,
        setSelectedRoads,
        dataType,
        setDataType,
        showRoadSelector,
        setShowRoadSelector,
        availableRoads,
        searchTerm,
        setSearchTerm,
        isGenerating,
        handleRoadToggle,
        handleGenerateReport,
        getFilteredRoads,
        availableRanges,
        setAvailableRanges,
        previewData,
        generatePreview,
        formatColumnName,
        validateField,
        validateAllFields,
        handleTimeChange,
    };
};

export const useViewReportsController = () => {
    const [reports, setReports] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [reportType, setReportType] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [selectedReport, setSelectedReport] = useState(null);
    const [reportContent, setReportContent] = useState(null);
    const [isLoadingContent, setIsLoadingContent] = useState(false);

    const fetchReports = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/reports/list`,
                {
                    params: {
                        search: searchTerm,
                        type: reportType
                    },
                    withCredentials: true
                }
            );
            
            if (response.status === 200) {
                setReports(response.data.reports);
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchReportContent = async (reportId) => {
        try {
            setIsLoadingContent(true);
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/reports/${reportId}`,
                { withCredentials: true }
            );
            
            if (response.status === 200) {
                setReportContent(response.data);
            }
        } catch (error) {
            console.error('Error fetching report content:', error);
            setReportContent(null);
        } finally {
            setIsLoadingContent(false);
        }
    };

    useEffect(() => {
        fetchReports();
    }, [searchTerm, reportType]);

    const handleDownload = async (report) => {
        try {
            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/reports/${report._id}/download`,
                {
                    responseType: 'blob',
                    withCredentials: true
                }
            );

            if (response.status === 200) {
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `traffic-report-${report._id}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                toast.success('Report downloaded successfully', toastConfig);
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            let errorMessage = 'Error downloading report. Please try again.';
            if (error.response?.status === 401) {
                errorMessage = 'Session expired. Please log in again.';
                // Optionally redirect to login
                window.location.href = '/login';
            }
            toast.error(errorMessage, toastConfig);
        }
    };

    const handleDelete = async (reportId) => {
        const confirmToastId = "confirm-delete-toast";

        toast.warn(
            <div style={{ width: '100%' }}>
                <div style={{ marginBottom: '15px', textAlign: 'center' }}>
                    Are you sure you want to delete this report?
                </div>
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    gap: '8px',
                    width: '100%'
                }}>
                    <button 
                        onClick={async () => {
                            toast.dismiss(confirmToastId);
                            try {
                                const response = await axios.delete(
                                    `${process.env.REACT_APP_API_URL}/reports/${reportId}`,
                                    { withCredentials: true }
                                );
                                
                                if (response.status === 200) {
                                    // Update local state
                                    setReports(prevReports => 
                                        prevReports.filter(report => report._id !== reportId)
                                    );
                                    
                                    // Clear selected report if it was deleted
                                    if (selectedReport?._id === reportId) {
                                        setSelectedReport(null);
                                        setReportContent(null);
                                        setIsLoadingContent(false);
                                    }
                                    
                                    toast.success('Report deleted successfully', toastConfig);
                                }
                            } catch (error) {
                                if (error.response?.status === 401) {
                                    window.location.href = '/login';
                                    toast.error('Session expired. Please log in again.', toastConfig);
                                } else {
                                    toast.error('Error deleting report', toastConfig);
                                }
                            }
                        }}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            width: '80px'
                        }}
                    >
                        Delete
                    </button>
                    <button 
                        onClick={() => toast.dismiss(confirmToastId)}
                        style={{
                            padding: '6px 12px',
                            backgroundColor: '#6c757d',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            width: '80px'
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </div>,
            {
                ...toastConfig,
                position: "top-center", // Change position to top-center
                toastId: confirmToastId,
                autoClose: false,
                closeOnClick: false,
                closeButton: false,
                style: {
                    width: '300px',
                    padding: '15px',
                    margin: '0 auto' // Center horizontally
                }
            }
        );
    };

    const handleSelectReport = async (report) => {
        try {
            setSelectedReport(report);
            setIsLoadingContent(true);

            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/reports/${report._id}`,
                { 
                    params: { includeIncidents: true }, // Add this parameter
                    withCredentials: true 
                }
            );
            
            if (response.status === 200) {
                setReportContent(response.data);
            }
        } catch (error) {
            console.error('Error fetching report content:', error);
            setReportContent(null);
        } finally {
            setIsLoadingContent(false);
        }
    };

    const renderReportContent = (reportContent, selectedReport, isLoadingContent, formatColumnName) => {
        if (isLoadingContent) {
            return { type: 'loading' };
        }

        if (!reportContent) {
            return { type: 'empty' };
        }

        if (selectedReport?.reportFormat === 'pdf') {
            return {
                type: 'pdf',
                url: `${process.env.REACT_APP_API_URL}/reports/${selectedReport._id}?format=pdf`
            };
        }

        return {
            type: 'data',
            metadata: reportContent.metadata,
            filters: reportContent.filters,
            columns: reportContent.columns,
            data: reportContent.data
        };
    };

    const formatColumnName = (column) => {
        switch(column) {
            case 'streetName':
                return 'Street Name';
            case 'currentSpeed':
                return 'Current Speed';
            case 'freeFlowSpeed':
                return 'Free Flow Speed';
            case 'accidentCount':
                return 'Accident Count';
            case 'congestionCount':
                return 'Congestion Count';
            case 'incidentCount':
                return 'Incident Count';
            default:
                return column.charAt(0).toUpperCase() + 
                       column.slice(1).replace(/([A-Z])/g, ' $1');
        }
    };

    return {
        reports,
        searchTerm,
        setSearchTerm,
        reportType,
        setReportType,
        isLoading,
        selectedReport,
        setSelectedReport,
        handleDownload,
        handleDelete,
        reportContent,
        isLoadingContent,
        handleSelectReport,
        formatColumnName,
        renderReportContent
    };
};

export const useTrafficAnalysisController = () => {
    const [selectedRoads, setSelectedRoads] = useState([]);
    const [showRoadSelector, setShowRoadSelector] = useState(false);
    const [availableRoads, setAvailableRoads] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [analysisDate, setAnalysisDate] = useState('');
    const [timeRange, setTimeRange] = useState({ start: '', end: '' });
    const [metric, setMetric] = useState('speed');
    const [chartData, setChartData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [availableRanges, setAvailableRanges] = useState({
        dateRange: { start: '', end: '' },
        timeRange: { start: '', end: '' }
    });

    const fetchAvailableRoads = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/traffic/roads`);
            if (response.status === 200) {
                setAvailableRoads(response.data);
            }
        } catch (error) {
            console.error('Error fetching roads:', error);
            setError('Failed to fetch available roads');
        }
    };

    const fetchAvailableRanges = async () => {
        try {
            const response = await axios.get(`${process.env.REACT_APP_API_URL}/traffic/available-ranges`);
            if (response.status === 200) {
                // Convert DD-MM-YYYY to YYYY-MM-DD for input fields
                const { dateRange, timeRange } = response.data;
                const convertDate = (dateStr) => {
                    const [day, month, year] = dateStr.split('-');
                    return `${year}-${month}-${day}`;
                };

                setAvailableRanges({
                    dateRange: {
                        start: convertDate(dateRange.start),
                        end: convertDate(dateRange.end)
                    },
                    timeRange: timeRange
                });
            }
        } catch (error) {
            console.error('Error fetching available ranges:', error);
            setError('Failed to fetch available date ranges');
        }
    };

    const validateAnalysisInputs = () => {
        // Date validation
        if (!analysisDate) {
            toast.error('Please select a date', toastConfig);
            return false;
        }

        // Time range validation
        if (!timeRange.start && !timeRange.end) {
            toast.error('Please select both start and end time', toastConfig);
            return false;
        }
        if (!timeRange.start) {
            toast.error('Please select a start time', toastConfig);
            return false;
        }
        if (!timeRange.end) {
            toast.error('Please select an end time', toastConfig);
            return false;
        }
        if (timeRange.start >= timeRange.end) {
            toast.error('End time must be later than start time', toastConfig);
            return false;
        }

        // Roads validation
        if (selectedRoads.length === 0) {
            toast.error('Please select at least one road', toastConfig);
            return false;
        }

        return true;
    };

    const fetchAnalysisData = async () => {
        if (!validateAnalysisInputs()) {
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            selectedRoads.forEach(road => params.append('roads', road));
            params.append('date', analysisDate);
            params.append('startTime', timeRange.start);
            params.append('endTime', timeRange.end);
            params.append('metric', metric);

            const response = await axios.get(
                `${process.env.REACT_APP_API_URL}/traffic/analysis?${params.toString()}`
            );

            if (response.status === 200) {
                setChartData(response.data);
                toast.success('Analysis data loaded successfully', toastConfig);
            }
        } catch (error) {
            console.error('Error fetching analysis:', error);
            setError('Failed to fetch analysis data');
            toast.error('Failed to fetch analysis data', toastConfig);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAvailableRanges();
        fetchAvailableRoads();
    }, []);

    const handleRoadToggle = (road) => {
        setSelectedRoads(prev => 
            prev.includes(road)
                ? prev.filter(r => r !== road)
                : selectedRoads.length < 5
                    ? [...prev, road]
                    : prev
        );
    };

    const getFilteredRoads = () => {
        return availableRoads.filter(road =>
            road.toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const clearAll = () => {
        setSelectedRoads([]);
        setAnalysisDate('');
        setTimeRange({ start: '', end: '' });
        setMetric('speed');
        setChartData(null);
        setError(null);
        toast.info('All filters cleared', toastConfig);
    };

    const handleTimeChange = (type, value) => {
        if (type === 'start') {
            // If end time exists and is earlier than new start time, reset end time
            if (timeRange.end && value > timeRange.end) {
                setTimeRange({ start: value, end: '' });
            } else {
                setTimeRange(prev => ({ ...prev, start: value }));
            }
        } else {
            // Only allow end time to be set if it's later than start time
            if (!timeRange.start || value >= timeRange.start) {
                setTimeRange(prev => ({ ...prev, end: value }));
            }
        }
    };

    return {
        selectedRoads,
        showRoadSelector,
        setShowRoadSelector,
        searchTerm,
        setSearchTerm,
        analysisDate,
        setAnalysisDate,
        timeRange,
        setTimeRange,
        metric,
        setMetric,
        chartData,
        isLoading,
        error,
        handleRoadToggle,
        getFilteredRoads,
        fetchAnalysisData,
        availableRanges,
        clearAll,
        handleTimeChange,
        validateAnalysisInputs,
    };
};