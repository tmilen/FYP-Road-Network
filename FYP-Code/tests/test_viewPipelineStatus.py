import unittest
from flask import json
from unittest.mock import MagicMock, patch, mock_open
import sys
import os
from datetime import datetime
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestMetrics(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Dynamically construct the full path to roads.txt
        cls.roads_file_path = os.path.abspath(os.path.join(
            os.path.dirname(__file__),  # Current test file's directory
            '../FlowX/src/roads.txt'    # Relative path to roads.txt
        ))
        print("Resolved Roads File Path:", cls.roads_file_path)

        # Create mock database client and collections
        cls.mock_client = MagicMock()
        cls.db = MagicMock()
        cls.traffic_logs = MagicMock()
        cls.current_traffic_data = MagicMock()
        
        # Setup mock database structure
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'TSUN-TESTING': cls.db
        }.get(x, MagicMock())
        cls.db.__getitem__.side_effect = lambda x: {
            'traffic_logs': cls.traffic_logs,
            'current_traffic_data': cls.current_traffic_data
        }.get(x, MagicMock())

        # Mock document count queries
        cls.current_traffic_data.count_documents = MagicMock(return_value=100)
        cls.traffic_logs.count_documents.side_effect = lambda query: (
            80 if query.get("status") == "success" else
            10 if query.get("status") == "failure" else
            5 if query.get("status") == "duplicate" else 0
        )
        # Mock finding recent log
        cls.traffic_logs.find_one = MagicMock(return_value={
            "date": "01-01-2025",
            "time": "12:00"
        })

    def setUp(self):
        with patch('app.open', new_callable=mock_open, read_data="Road A,1.3,103.85\nRoad B,1.2,103.84\n"):
            with patch('gridfs.GridFS') as mock_gridfs:
                self.app = create_app(db_client=self.mock_client)
                self.client = self.app.test_client()


    # Test the /api/metrics endpoint
    @patch("app.open", new_callable=mock_open, read_data="Road A,1.3,103.85\nRoad B,1.2,103.84\n")
    def test_get_metrics(self, mock_open):
       
        response = self.client.get('/api/metrics')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['totalRoads'], 100)
        self.assertEqual(data['successfulCalls'], 80)
        self.assertEqual(data['failedCalls'], 10)
        self.assertEqual(data['duplicates'], 5)
        self.assertIsInstance(data['ingestionLatency'], (int, float))

    # Test the /api/recent-log endpoint
    @patch("app.open", new_callable=mock_open, read_data="Road A,1.3,103.85\nRoad B,1.2,103.84\n")
    def test_get_traffic_logs(self, mock_open):
       
        # Mock data with `datetime` objects for `timestamp`
        mock_logs = [
            {"timestamp": datetime(2025, 2, 1, 11, 30, 1), "roadName": "Road A", "status": "success", "message": "Processed"},
            {"timestamp": datetime(2025, 2, 1, 11, 35, 1), "roadName": "Road B", "status": "failure", "message": "Error"}
        ]

        # Mock the database response
        self.traffic_logs.find.return_value.sort.return_value.limit.return_value = mock_logs

        # Make the request to the endpoint
        response = self.client.get('/api/live-traffic-logs')
        
        # Validate the response
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data['logs']), 2)
        self.assertEqual(data['logs'][0]['roadName'], "Road A")
        self.assertEqual(data['logs'][1]['status'], "failure")

if __name__ == '__main__':
    unittest.main()
