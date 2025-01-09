import unittest
from flask import json
from unittest.mock import MagicMock, patch
import sys
import os
from datetime import datetime
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestFilteredTrafficData(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create main mock client with dictionary access support
        cls.mock_client = MagicMock()
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'traffic-users': cls.db,
            'TSUN-TESTING': cls.mock_gridfs_db
        }.get(x, MagicMock())
        
        # Initialize database mocks
        cls.db = MagicMock()
        cls.mock_gridfs_db = MagicMock()
        cls.historical_traffic_data = cls.mock_gridfs_db['historical_traffic_data']

        # Mock data
        cls.mock_historical_data = [
            {
                "road_id": "road_1",
                "streetName": "Test Road",
                "date": "09-01-2024",
                "time": "14:30",
                "timestamp": datetime(2024, 1, 9, 14, 30),
                "currentSpeed": 60,
                "freeFlowSpeed": 80,
                "intensity": "medium",
                "accidentCount": 1,
                "congestionCount": 2
            },
            {
                "road_id": "road_1",
                "streetName": "Test Road",
                "date": "09-01-2024",
                "time": "15:30",
                "timestamp": datetime(2024, 1, 9, 15, 30),
                "currentSpeed": 40,
                "freeFlowSpeed": 80,
                "intensity": "high",
                "accidentCount": 2,
                "congestionCount": 3
            }
        ]

        def mock_find(*args, **kwargs):
            query = args[0] if args else kwargs.get('filter', {})
            filtered_data = []
            
            for record in cls.mock_historical_data:
                matches = True
                
                # Check road_id
                if 'road_id' in query and query['road_id'] != record['road_id']:
                    matches = False
                
                # Check date range
                if 'date' in query:
                    if '$gte' in query['date'] and record['date'] < query['date']['$gte']:
                        matches = False
                    if '$lte' in query['date'] and record['date'] > query['date']['$lte']:
                        matches = False

                # Check time range
                if 'time' in query:
                    if '$gte' in query['time'] and record['time'] < query['time']['$gte']:
                        matches = False
                    if '$lte' in query['time'] and record['time'] > query['time']['$lte']:
                        matches = False

                # Check intensity
                if 'intensity' in query and '$in' in query['intensity']:
                    if record['intensity'] not in query['intensity']['$in']:
                        matches = False

                if matches:
                    filtered_data.append(record)

            # Return a mock object that supports chaining
            mock_result = MagicMock()
            mock_result.sort = MagicMock(return_value=filtered_data)
            return mock_result

        def mock_count_documents(query):
            return sum(1 for record in cls.mock_historical_data
                     if record['road_id'] == query.get('road_id')
                     and record['intensity'] == query.get('intensity'))

        cls.historical_traffic_data.find = MagicMock(side_effect=mock_find)
        cls.historical_traffic_data.count_documents = MagicMock(side_effect=mock_count_documents)

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

    def test_get_historical_traffic_basic(self):
        """Test getting historical traffic data for a specific road"""
        response = self.client.get('/api/traffic/history?road_id=road_1')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data['data']), 2)
        self.assertIn('totalIncidents', data)

    def test_get_historical_traffic_with_date_filter(self):
        """Test filtering historical data by date range"""
        response = self.client.get('/api/traffic/history?road_id=road_1&startDate=2024-01-09&endDate=2024-01-09')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data['data']), 2)

    def test_get_historical_traffic_with_time_filter(self):
        """Test filtering historical data by time range"""
        response = self.client.get('/api/traffic/history?road_id=road_1&startTime=14:00&endTime=16:00')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data['data']), 2)

    def test_get_historical_traffic_with_intensity_filter(self):
        """Test filtering historical data by traffic intensity"""
        response = self.client.get('/api/traffic/history?road_id=road_1&conditions=high')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data['data']), 1)
        self.assertEqual(data['data'][0]['intensity'], 'high')

    def test_get_historical_traffic_no_road_id(self):
        """Test error handling when no road_id is provided"""
        response = self.client.get('/api/traffic/history')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Road ID is required')

if __name__ == '__main__':
    unittest.main()
