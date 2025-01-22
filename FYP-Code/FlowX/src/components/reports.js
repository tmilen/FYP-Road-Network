import { useState, useEffect } from 'react';
import { FaFilePdf, FaChartLine, FaChartBar, FaList } from 'react-icons/fa';
import axios from 'axios';

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
        },
        { 
            id: 'congestion',
            title: 'Congestion Reports', 
            icon: <FaChartBar />,
            description: 'Analysis of traffic congestion patterns and hotspots'
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
    const [message, setMessage] = useState(null);

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

    const validateInputs = () => {
        const hasDateRange = dateRange.start || dateRange.end;
        const hasTimeRange = timeRange.start || timeRange.end;
        const hasRoads = selectedRoads.length > 0;
        const hasDataType = dataType !== '';

        // At least one filter must be provided
        if (!hasDateRange && !hasTimeRange && !hasRoads) {
            setMessage({
                type: 'error',
                text: 'Please provide at least one filter (Date, Time, or Roads)'
            });
            return false;
        }

        // If date range is partially filled, require both start and end
        if (hasDateRange && (!dateRange.start || !dateRange.end)) {
            setMessage({
                type: 'error',
                text: 'Please provide both start and end dates'
            });
            return false;
        }

        // If time range is partially filled, require both start and end
        if (hasTimeRange && (!timeRange.start || !timeRange.end)) {
            setMessage({
                type: 'error',
                text: 'Please provide both start and end times'
            });
            return false;
        }

        // Validate date order if both dates are provided
        if (dateRange.start && dateRange.end && dateRange.start > dateRange.end) {
            setMessage({
                type: 'error',
                text: 'Start date cannot be later than end date'
            });
            return false;
        }

        // Validate time order if both times are provided
        if (timeRange.start && timeRange.end && timeRange.start > timeRange.end) {
            setMessage({
                type: 'error',
                text: 'Start time cannot be later than end time'
            });
            return false;
        }

        // Validate that data type is selected
        if (!hasDataType) {
            setMessage({
                type: 'error',
                text: 'Please select a data type for the report'
            });
            return false;
        }

        // If a date range is provided, require a time range
        if (hasDateRange && !hasTimeRange) {
            setMessage({
                type: 'error',
                text: 'Please provide both time range when using date range'
            });
            return false;
        }

        // If a time range is provided, require a date range
        if (hasTimeRange && !hasDateRange) {
            setMessage({
                type: 'error',
                text: 'Please provide both date range when using time range'
            });
            return false;
        }

        setMessage(null);
        return true;
    };

    const handleGenerateReport = async () => {
        if (!validateInputs()) return;

        setIsGenerating(true);
        try {
            const reportData = {
                dataType,
                dateRange: dateRange.start && dateRange.end ? dateRange : null,
                timeRange: timeRange.start && timeRange.end ? timeRange : null,
                selectedRoads: selectedRoads.length > 0 ? selectedRoads : null,
                includeIncidents: dataType === 'incidents' || dataType === 'comprehensive', // Only include incidents for relevant reports
                metadata: {
                    generatedAt: new Date().toISOString(),
                    reportType: 'standard'
                }
            };

            const response = await axios.post(
                `${process.env.REACT_APP_API_URL}/reports`, 
                reportData,
                {
                    responseType: 'blob',  // Always PDF now
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    withCredentials: true  // Add this line to include credentials
                }
            );

            if (response.status === 200) {
                // Handle PDF download
                const blob = new Blob([response.data], { type: 'application/pdf' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `traffic-report-${new Date().toISOString()}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            }
        } catch (error) {
            console.error('Error generating report:', error);
            let errorMessage = 'Error generating report. Please try again.';
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Your session has expired. Please log in again.';
                    // Optionally redirect to login page
                    window.location.href = '/login';
                } else {
                    errorMessage = error.response.data.message || errorMessage;
                }
            }
            alert(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateReportWithMessage = async () => {
        try {
            setMessage(null);
            
            if (!validateInputs()) {
                return;
            }

            setIsGenerating(true);
            await handleGenerateReport();
            setMessage({
                type: 'success',
                text: 'Report generated successfully. You can find it in the View Reports section.'
            });
        } catch (error) {
            let errorMessage = 'Error generating report. Please try again.';
            if (error.response) {
                if (error.response.status === 401) {
                    errorMessage = 'Your session has expired. Please log in again.';
                } else if (error.response.status === 404) {
                    errorMessage = 'No data found for the selected criteria.';
                } else {
                    errorMessage = error.response.data.message || errorMessage;
                }
            }
            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsGenerating(false);
        }
    };

    const generatePreview = async () => {
        if (!validateInputs()) return;  // Only basic validation for preview

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
            console.error('Error generating preview:', error);
            setPreviewData(null);
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
        handleGenerateReportWithMessage,
        getFilteredRoads,
        availableRanges,
        setAvailableRanges,
        previewData,
        generatePreview,
        formatColumnName,
        message,
        setMessage,
        validateInputs,
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
            }
        } catch (error) {
            console.error('Error downloading report:', error);
            let errorMessage = 'Error downloading report. Please try again.';
            if (error.response?.status === 401) {
                errorMessage = 'Session expired. Please log in again.';
                // Optionally redirect to login
                window.location.href = '/login';
            }
            alert(errorMessage);
        }
    };

    const handleDownloadWithMessage = async (report) => {
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
                return { success: true, message: 'Report downloaded successfully' };
            }
        } catch (error) {
            let errorMessage = 'Error downloading report. Please try again.';
            if (error.response?.status === 401) {
                errorMessage = 'Your session has expired. Please log in again.';
            }
            throw new Error(errorMessage);
        }
    };

    const handleDelete = async (reportId) => {
        try {
            if (!window.confirm('Are you sure you want to delete this report?')) {
                return;
            }

            const response = await axios.delete(
                `${process.env.REACT_APP_API_URL}/reports/${reportId}`,
                { withCredentials: true }
            );

            if (response.status === 200) {
                // Remove the deleted report from the local state
                setReports(reports.filter(report => report._id !== reportId));
                
                // If the deleted report was selected, clear the selection and content
                if (selectedReport?._id === reportId) {
                    setSelectedReport(null);
                    setReportContent(null);
                    setIsLoadingContent(false); // Add this line to ensure loading state is reset
                }
                
                alert('Report deleted successfully');
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            let errorMessage = 'Error deleting report. Please try again.';
            if (error.response?.status === 401) {
                errorMessage = 'Session expired. Please log in again.';
                window.location.href = '/login';
            }
            alert(errorMessage);
        }
    };

    const handleDeleteWithMessage = async (reportId) => {
        try {
            if (!window.confirm('Are you sure you want to delete this report?')) {
                return;
            }

            const response = await axios.delete(
                `${process.env.REACT_APP_API_URL}/reports/${reportId}`,
                { withCredentials: true }
            );

            if (response.status === 200) {
                setReports(reports.filter(report => report._id !== reportId));
                if (selectedReport?._id === reportId) {
                    setSelectedReport(null);
                    setReportContent(null);
                }
                return { success: true, message: 'Report deleted successfully' };
            }
        } catch (error) {
            let errorMessage = 'Error deleting report. Please try again.';
            if (error.response?.status === 401) {
                errorMessage = 'Your session has expired. Please log in again.';
            }
            throw new Error(errorMessage);
        }
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
        handleDownloadWithMessage,
        handleDelete,
        handleDeleteWithMessage,
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

    const fetchAnalysisData = async () => {
        if (!analysisDate || !timeRange.start || !timeRange.end || selectedRoads.length === 0) {
            setError('Please select all required filters');
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
            }
        } catch (error) {
            console.error('Error fetching analysis:', error);
            setError('Failed to fetch analysis data');
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
    };
};

export const useCongestionReportController = () => {
    // TODO: Implement congestion report logic
    return {};
};
