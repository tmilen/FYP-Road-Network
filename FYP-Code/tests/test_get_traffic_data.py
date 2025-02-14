import unittest
from unittest.mock import Mock, patch
from datetime import datetime
from bson import ObjectId
from flask import Flask
import json
import mongomock
import pytest

class TestGetTrafficData(unittest.TestCase):
    def setUp(self):
        # Create Flask test app
        self.app = Flask(__name__)
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()

        # Create mock MongoDB collections
        self.mock_current_traffic = mongomock.MongoClient().db.collection
        self.mock_traffic_incidents = mongomock.MongoClient().db.incidents

        # Sample traffic data
        self.sample_traffic_data = [
            {
                "road_id": "road_1",
                "streetName": "Orchard Road",
                "coordinates": {"lat": 1.3048, "lng": 103.8318},
                "date": "08-02-2025",
                "time": "14:30",
                "currentSpeed": 40,
                "freeFlowSpeed": 60,
                "intensity": "medium"
            },
            {
                "road_id": "road_2",
                "streetName": "Marina Bay",
                "coordinates": {"lat": 1.2847, "lng": 103.8610},
                "date": "08-02-2025",
                "time": "15:00",
                "currentSpeed": 20,
                "freeFlowSpeed": 60,
                "intensity": "high"
            }
        ]

        # Sample incident data
        self.sample_incidents = [
            {
                "road_id": "road_1",
                "type": "ACCIDENT",
                "recorded_at": datetime.now()
            },
            {
                "road_id": "road_1",
                "type": "CONGESTION",
                "recorded_at": datetime.now()
            }
        ]

        # Insert sample data into mock collections
        self.mock_current_traffic.insert_many(self.sample_traffic_data)
        self.mock_traffic_incidents.insert_many(self.sample_incidents)

        # Create patcher for the collections
        self.patchers = [
            patch('app.current_traffic_data', self.mock_current_traffic),
            patch('app.traffic_incidents', self.mock_traffic_incidents)
        ]
        
        # Start all patchers
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self):
        # Stop all patchers
        for patcher in self.patchers:
            patcher.stop()

    def test_get_traffic_data_success(self):
        """Test successful retrieval of traffic data"""
        with self.app.test_request_context('/api/traffic/data'):
            from app import get_traffic_data
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]['streetName'], 'Orchard Road')
            self.assertEqual(data[1]['streetName'], 'Marina Bay')

    def test_search_filter(self):
        """Test filtering by search term"""
        with self.app.test_request_context('/api/traffic/data?search=orchard'):
            from app import get_traffic_data
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]['streetName'], 'Orchard Road')

    def test_date_filter(self):
        """Test filtering by date range"""
        with self.app.test_request_context(
            '/api/traffic/data?startDate=2025-02-08&endDate=2025-02-08'
        ):
            from app import get_traffic_data
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]['date'], '08-02-2025')

    def test_time_filter(self):
        """Test filtering by time range"""
        with self.app.test_request_context(
            '/api/traffic/data?startTime=14:00&endTime=14:45'
        ):
            from app import get_traffic_data
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]['time'], '14:30')

    def test_condition_filter(self):
        """Test filtering by traffic intensity"""
        with self.app.test_request_context(
            '/api/traffic/data?conditions=high'
        ):
            from app import get_traffic_data
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]['intensity'], 'high')

    def test_incident_counts(self):
        """Test that incident counts are correctly added to traffic data"""
        with self.app.test_request_context('/api/traffic/data'):
            from app import get_traffic_data
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 200)
            first_road = data[0]
            self.assertIn('accidentCount', first_road)
            self.assertIn('congestionCount', first_road)
            self.assertEqual(first_road['accidentCount'], 1)
            self.assertEqual(first_road['congestionCount'], 1)

    def test_error_handling(self):
        """Test error handling when database operation fails"""
        with self.app.test_request_context('/api/traffic/data'):
            from app import get_traffic_data
            
            # Mock database error
            self.mock_current_traffic.find = Mock(side_effect=Exception("Database error"))
            
            response = get_traffic_data()
            data = json.loads(response.get_data(as_text=True))
            
            self.assertEqual(response.status_code, 500)
            self.assertIn('message', data)
            self.assertTrue(data['message'].startswith('Error fetching traffic data'))

if __name__ == '__main__':
    unittest.main()