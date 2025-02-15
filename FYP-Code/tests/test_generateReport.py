import unittest
from flask import json
from pymongo import MongoClient
from unittest.mock import MagicMock, patch
from io import BytesIO
import sys
import os
from datetime import datetime
import pytz
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestGenerateReport(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create main mock client
        cls.mock_client = MagicMock(spec=MongoClient)
        cls.db = MagicMock()
        cls.mock_gridfs_db = MagicMock()
        cls.historical_traffic_data = MagicMock()
        cls.reports_collection = MagicMock()
        cls.traffic_incidents = MagicMock()
        cls.mock_reports = []
        cls.mock_traffic_data = []

        # Setup mock database structure
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'traffic-data': cls.db,
        }.get(x, MagicMock())

        # Setup collections
        cls.db.__getitem__.side_effect = lambda x: {
            'historical_traffic_data': cls.historical_traffic_data,
            'reports': cls.reports_collection,
            'traffic_incidents': cls.traffic_incidents
        }.get(x, MagicMock())

        # Mock historical traffic data methods
        def mock_traffic_find(query=None, projection=None):
            mock_cursor = MagicMock()
            mock_cursor.sort.return_value = mock_cursor
            
            # Return empty results for "Nonexistent Road"
            if query and query.get('streetName', {}).get('$in', []) == ['Nonexistent Road']:
                mock_cursor.__iter__.return_value = iter([])
            else:
                mock_cursor.__iter__.return_value = iter([{
                    'streetName': 'Test Road',
                    'date': '01-01-2024',
                    'time': '12:00',
                    'currentSpeed': 60,
                    'freeFlowSpeed': 80,
                    'intensity': 'medium',
                    'road_id': 'road_1'
                }])
            return mock_cursor

        cls.historical_traffic_data.find.side_effect = mock_traffic_find

        # Mock traffic incidents methods
        cls.traffic_incidents.count_documents.return_value = 2

        # Mock reports collection methods
        def mock_report_insert_one(data):
            cls.mock_reports.append(data)
            return MagicMock(inserted_id="mock_report_id")

        cls.reports_collection.insert_one.side_effect = mock_report_insert_one

    def setUp(self):
        # Mock GridFS
        gridfs_patcher = patch('gridfs.GridFS')
        self.mock_gridfs = gridfs_patcher.start()
        self.addCleanup(gridfs_patcher.stop)

        # Setup GridFS put method
        self.mock_gridfs.return_value.put.return_value = 'mock_file_id'

        self.app = create_app(db_client=self.mock_client)
        self.client = self.app.test_client()
        self.mock_reports.clear()

        # Set up session
        with self.client.session_transaction() as sess:
            sess['username'] = 'test_user'
            sess['role'] = 'traffic_analyst'

    def test_generate_report_success(self):
        """Test successful report generation"""
        response = self.client.post('/api/reports', json={
            "dataType": "traffic",
            "dateRange": {
                "start": "2024-01-01",
                "end": "2024-01-02"
            },
            "timeRange": {
                "start": "09:00",
                "end": "17:00"
            },
            "selectedRoads": ["Test Road"],
            "metadata": {
                "reportType": "standard"
            }
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, 'application/pdf')
        self.assertTrue(response.data)  # Check if PDF data exists

    def test_generate_report_no_data(self):
        """Test report generation with no matching data"""
        response = self.client.post('/api/reports', json={
            "dataType": "traffic",
            "dateRange": {
                "start": "2024-01-01",
                "end": "2024-01-02"
            },
            "selectedRoads": ["Nonexistent Road"]
        })

        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'No data found for the selected criteria')

    def test_generate_report_unauthorized(self):
        """Test report generation without authentication"""
        with self.client.session_transaction() as sess:
            sess.clear()  # Clear session to test unauthorized access

        response = self.client.post('/api/reports', json={
            "dataType": "traffic",
            "dateRange": {
                "start": "2024-01-01",
                "end": "2024-01-02"
            },
            "selectedRoads": ["Test Road"]
        })

        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Unauthorized - Please log in')

    def test_generate_comprehensive_report(self):
        """Test generation of comprehensive report with incidents"""
        response = self.client.post('/api/reports', json={
            "dataType": "comprehensive",
            "dateRange": {
                "start": "2024-01-01",
                "end": "2024-01-02"
            },
            "timeRange": {
                "start": "09:00",
                "end": "17:00"
            },
            "selectedRoads": ["Test Road"],
            "metadata": {
                "reportType": "comprehensive"
            }
        })

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content_type, 'application/pdf')
        self.assertTrue(response.data)  # Verify PDF data exists

if __name__ == '__main__':
    unittest.main()
