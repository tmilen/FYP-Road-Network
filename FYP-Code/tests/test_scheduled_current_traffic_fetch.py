import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import pytz
import requests
import mongomock
from bson import ObjectId

class TestFetchCurrentTraffic(unittest.TestCase):
    def setUp(self):
        # Mock MongoDB collections
        self.mock_current_traffic = mongomock.MongoClient().db.collection
        self.mock_traffic_logs = mongomock.MongoClient().db.logs
        
        # Set up Singapore timezone
        self.SGT = pytz.timezone('Asia/Singapore')
        
        # Sample road data
        self.SINGAPORE_ROADS = [
            {
                "name": "Orchard Road",
                "lat": 1.3048,
                "lng": 103.8318
            },
            {
                "name": "Marina Bay",
                "lat": 1.2847,
                "lng": 103.8610
            }
        ]
        
        # Mock successful TomTom API response
        self.mock_success_response = {
            'flowSegmentData': {
                'currentSpeed': 45,
                'freeFlowSpeed': 60,
                'confidence': 0.9
            }
        }
        
        # Patch dependencies
        self.patches = [
            patch('app.current_traffic_data', self.mock_current_traffic),
            patch('app.traffic_logs', self.mock_traffic_logs),
            patch('app.SINGAPORE_ROADS', self.SINGAPORE_ROADS),
            patch('app.get_sgt_time', return_value=datetime.now(self.SGT))
        ]
        
        for patcher in self.patches:
            patcher.start()

    def tearDown(self):
        # Stop all patches
        for patcher in self.patches:
            patcher.stop()

    @patch('requests.get')
    def test_successful_traffic_fetch(self, mock_requests_get):
        """Test successful fetching of traffic data for all roads"""
        from app import fetch_current_traffic
        
        # Mock successful API response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = self.mock_success_response
        mock_requests_get.return_value = mock_response
        
        # Run the function
        result = fetch_current_traffic()
        
        self.assertTrue(result)
        
        # Verify data was stored for each road
        stored_data = list(self.mock_current_traffic.find())
        self.assertEqual(len(stored_data), len(self.SINGAPORE_ROADS))
        
        # Verify the content of stored data
        first_road = stored_data[0]
        self.assertEqual(first_road['streetName'], 'Orchard Road')
        self.assertEqual(first_road['currentSpeed'], 45)
        self.assertEqual(first_road['freeFlowSpeed'], 60)
        self.assertEqual(first_road['intensity'], 'medium')  # Based on speed ratio

    @patch('requests.get')
    def test_api_failure_handling(self, mock_requests_get):
        """Test handling of API failures"""
        from app import fetch_current_traffic
        
        # Mock failed API response
        mock_response = Mock()
        mock_response.status_code = 500
        mock_requests_get.return_value = mock_response
        
        # Run the function
        result = fetch_current_traffic()
        
        # Verify error logging
        error_logs = list(self.mock_traffic_logs.find({'status': 'failure'}))
        self.assertGreater(len(error_logs), 0)

    @patch('requests.get')
    def test_intensity_calculation(self, mock_requests_get):
        """Test traffic intensity calculations for different speed ratios"""
        from app import fetch_current_traffic
        
        test_cases = [
            # current_speed, free_flow_speed, expected_intensity
            (48, 60, 'low'),      # 0.8 ratio
            (36, 60, 'medium'),   # 0.6 ratio
            (24, 60, 'high')      # 0.4 ratio
        ]
        
        for current_speed, free_flow_speed, expected_intensity in test_cases:
            # Mock API response with test speeds
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                'flowSegmentData': {
                    'currentSpeed': current_speed,
                    'freeFlowSpeed': free_flow_speed
                }
            }
            mock_requests_get.return_value = mock_response
            
            # Clear previous data
            self.mock_current_traffic.delete_many({})
            
            # Run function
            fetch_current_traffic()
            
            # Verify intensity calculation
            stored_data = list(self.mock_current_traffic.find())
            self.assertEqual(stored_data[0]['intensity'], expected_intensity)

    @patch('requests.get')
    def test_hourly_historical_data(self, mock_requests_get):
        """Test that historical data is stored at hourly checkpoints"""
        from app import fetch_current_traffic
        
        # Set current time to exact hour
        current_time = datetime.now(self.SGT).replace(minute=0, second=0, microsecond=0)
        with patch('app.get_sgt_time', return_value=current_time):
            # Mock successful API response
            mock_response = Mock()
            mock_response.status_code = 200
            mock_response.json.return_value = self.mock_success_response
            mock_requests_get.return_value = mock_response
            
            # Run function
            fetch_current_traffic()
            
            # Verify historical data was stored
            historical_data = list(self.mock_current_traffic.find({
                'date': current_time.strftime('%d-%m-%Y'),
                'time': current_time.strftime('%H:%M')
            }))
            self.assertGreater(len(historical_data), 0)

    def test_quota_exceeded_handling(self):
        """Test handling of API quota exceeded scenario"""
        from app import fetch_current_traffic, check_api_quota
        
        # Mock quota check to indicate exceeded
        with patch('app.check_api_quota', return_value=True):
            result = fetch_current_traffic()
            self.assertFalse(result)
            
            # Verify no API calls were made
            stored_data = list(self.mock_current_traffic.find())
            self.assertEqual(len(stored_data), 0)

if __name__ == '__main__':
    unittest.main()