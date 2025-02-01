import unittest
from flask import json
from unittest.mock import MagicMock, patch, mock_open
import sys
import os
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestReadPerformanceMetrics(unittest.TestCase):
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

        # Setup mock database structure
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'TSUN-TESTING': cls.db
        }.get(x, MagicMock())
        cls.db.__getitem__.side_effect = lambda x: {
            'traffic_logs': cls.traffic_logs
        }.get(x, MagicMock())

        # Mock data for pie-chart endpoint
        cls.traffic_logs.count_documents.side_effect = lambda query: (
            100 if query == {} else 30 if query.get("status") == "duplicate" else 0
        )

        # Mock data for line-chart endpoint
        cls.mock_line_chart_data = [
            {"_id": "01-02-2025", "successful": 10, "failed": 5, "duplicates": 3},
            {"_id": "02-02-2025", "successful": 8, "failed": 4, "duplicates": 2},
            {"_id": "03-02-2025", "successful": 12, "failed": 6, "duplicates": 4},
        ]
        cls.traffic_logs.aggregate.return_value = cls.mock_line_chart_data

    def setUp(self):
        with patch('gridfs.GridFS') as mock_gridfs, \
            patch('app.open', new_callable=mock_open, read_data="Road A,1.3,103.85\nRoad B,1.2,103.84\n"):
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

    # Test the /api/pie-chart-data endpoint
    def test_get_pie_chart_data(self):
    
        response = self.client.get('/api/pie-chart-data')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['labels'], ["Unique Entries", "Duplicate Entries"])
        self.assertEqual(data['values'], [70, 30])  # Unique = Total - Duplicate

    # Test the /api/line-chart-data endpoint
    def test_get_line_chart_data(self):
        
        response = self.client.get('/api/line-chart-data')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['labels'], ["01-02-2025", "02-02-2025", "03-02-2025"])
        datasets = data['datasets']
        self.assertEqual(len(datasets), 3)

        # Validate datasets
        self.assertEqual(datasets[0]['label'], "Successful Calls")
        self.assertEqual(datasets[0]['data'], [10, 8, 12])

        self.assertEqual(datasets[1]['label'], "Failed Calls")
        self.assertEqual(datasets[1]['data'], [5, 4, 6])

        self.assertEqual(datasets[2]['label'], "Duplicate Calls")
        self.assertEqual(datasets[2]['data'], [3, 2, 4])

if __name__ == '__main__':
    unittest.main()
