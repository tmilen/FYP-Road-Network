import unittest
from unittest.mock import Mock, patch
from datetime import datetime, timedelta
import mongomock
import pytz
import json

class TestDailyTrafficSummary(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test"""
        # Create mock MongoDB collections
        self.mock_historical_traffic = mongomock.MongoClient().db.historical
        self.mock_traffic_incidents = mongomock.MongoClient().db.incidents
        
        # Set up Singapore timezone
        self.SGT = pytz.timezone('Asia/Singapore')
        
        # Sample date for testing
        self.test_date = "08-02-2025"
        
        # Sample traffic data for the test date
        self.sample_traffic_data = [
            {
                "road_id": "road_1",
                "streetName": "Orchard Road",
                "date": self.test_date,
                "time": "08:00",
                "currentSpeed": 40,
                "freeFlowSpeed": 60,
                "intensity": "medium"
            },
            {
                "road_id": "road_1",
                "streetName": "Orchard Road",
                "date": self.test_date,
                "time": "17:00",
                "currentSpeed": 20,
                "freeFlowSpeed": 60,
                "intensity": "high"
            },
            {
                "road_id": "road_2",
                "streetName": "Marina Bay",
                "date": self.test_date,
                "time": "08:00",
                "currentSpeed": 45,
                "freeFlowSpeed": 50,
                "intensity": "low"
            }
        ]
        
        # Sample incident data
        self.sample_incidents = [
            {
                "road_id": "road_1",
                "type": "ACCIDENT",
                "start_time": datetime.strptime(f"{self.test_date} 08:30", "%d-%m-%Y %H:%M"),
                "status": "HISTORICAL"
            },
            {
                "road_id": "road_1",
                "type": "CONGESTION",
                "start_time": datetime.strptime(f"{self.test_date} 17:15", "%d-%m-%Y %H:%M"),
                "status": "HISTORICAL"
            }
        ]
        
        # Insert sample data into mock collections
        self.mock_historical_traffic.insert_many(self.sample_traffic_data)
        self.mock_traffic_incidents.insert_many(self.sample_incidents)
        
        # Create patchers
        self.patchers = [
            patch('app.historical_traffic_data', self.mock_historical_traffic),
            patch('app.traffic_incidents', self.mock_traffic_incidents),
            patch('app.get_sgt_time', return_value=datetime.now(self.SGT))
        ]
        
        # Start all patchers
        for patcher in self.patches:
            patcher.start()

    def tearDown(self):
        """Clean up after each test"""
        # Stop all patchers
        for patcher in self.patchers:
            patcher.stop()

    def test_basic_summary_structure(self):
        """Test that the daily summary contains all required sections"""
        from app import get_daily_traffic_summary
        
        summary = get_daily_traffic_summary(self.test_date)
        
        # Verify all required sections are present
        self.assertIn('date', summary)
        self.assertIn('overview', summary)
        self.assertIn('peak_hours', summary)
        self.assertIn('incidents', summary)
        self.assertIn('road_conditions', summary)
        
        # Verify date format
        self.assertEqual(summary['date'], self.test_date)

    def test_peak_hours_identification(self):
        """Test identification of morning and evening peak hours"""
        from app import get_daily_traffic_summary
        
        summary = get_daily_traffic_summary(self.test_date)
        peak_hours = summary['peak_hours']
        
        # Verify peak hours structure
        self.assertIn('morning_peak', peak_hours)
        self.assertIn('evening_peak', peak_hours)
        
        # Verify morning peak detection (8:00 AM data)
        self.assertEqual(peak_hours['morning_peak']['time'], '08:00')
        self.assertEqual(peak_hours['morning_peak']['average_speed'], 42.5)  # (40 + 45) / 2
        
        # Verify evening peak detection (5:00 PM data)
        self.assertEqual(peak_hours['evening_peak']['time'], '17:00')
        self.assertEqual(peak_hours['evening_peak']['average_speed'], 20)

    def test_incident_summary(self):
        """Test incident counting and categorization"""
        from app import get_daily_traffic_summary
        
        summary = get_daily_traffic_summary(self.test_date)
        incidents = summary['incidents']
        
        # Verify incident counts
        self.assertEqual(incidents['total_count'], 2)
        self.assertEqual(incidents['accidents'], 1)
        self.assertEqual(incidents['congestion_events'], 1)
        
        # Verify time distribution
        self.assertEqual(incidents['morning_incidents'], 1)  # 8:30 accident
        self.assertEqual(incidents['evening_incidents'], 1)  # 17:15 congestion

    def test_road_conditions_summary(self):
        """Test road conditions analysis"""
        from app import get_daily_traffic_summary
        
        summary = get_daily_traffic_summary(self.test_date)
        conditions = summary['road_conditions']
        
        # Verify road statistics
        self.assertEqual(len(conditions['monitored_roads']), 2)  # Orchard Road and Marina Bay
        
        # Verify congestion levels
        congestion = conditions['congestion_levels']
        self.assertEqual(congestion['high'], 1)    # One high intensity record
        self.assertEqual(congestion['medium'], 1)  # One medium intensity record
        self.assertEqual(congestion['low'], 1)     # One low intensity record

    def test_overview_metrics(self):
        """Test calculation of overview metrics"""
        from app import get_daily_traffic_summary
        
        summary = get_daily_traffic_summary(self.test_date)
        overview = summary['overview']
        
        # Verify average speeds
        self.assertIn('average_speed', overview)
        expected_avg_speed = (40 + 20 + 45) / 3
        self.assertEqual(overview['average_speed'], expected_avg_speed)
        
        # Verify congestion ratio
        self.assertIn('congestion_ratio', overview)
        expected_ratio = 2/3  # 2 out of 3 records show medium/high congestion
        self.assertEqual(overview['congestion_ratio'], expected_ratio)

    def test_invalid_date_handling(self):
        """Test handling of invalid dates"""
        from app import get_daily_traffic_summary
        
        # Test future date
        future_date = (datetime.now() + timedelta(days=1)).strftime("%d-%m-%Y")
        with self.assertRaises(ValueError):
            get_daily_traffic_summary(future_date)
        
        # Test invalid date format
        with self.assertRaises(ValueError):
            get_daily_traffic_summary("2025/02/08")

    def test_empty_data_handling(self):
        """Test handling of dates with no data"""
        from app import get_daily_traffic_summary
        
        # Clear all test data
        self.mock_historical_traffic.delete_many({})
        self.mock_traffic_incidents.delete_many({})
        
        summary = get_daily_traffic_summary(self.test_date)
        
        # Verify empty but valid summary structure
        self.assertEqual(summary['overview']['average_speed'], 0)
        self.assertEqual(summary['incidents']['total_count'], 0)
        self.assertEqual(len(summary['road_conditions']['monitored_roads']), 0)

    def test_concurrent_incidents(self):
        """Test handling of concurrent incidents"""
        from app import get_daily_traffic_summary
        
        # Add concurrent incidents
        concurrent_incidents = [
            {
                "road_id": "road_1",
                "type": "ACCIDENT",
                "start_time": datetime.strptime(f"{self.test_date} 08:30", "%d-%m-%Y %H:%M"),
                "status": "HISTORICAL"
            },
            {
                "road_id": "road_1",
                "type": "CONGESTION",
                "start_time": datetime.strptime(f"{self.test_date} 08:30", "%d-%m-%Y %H:%M"),
                "status": "HISTORICAL"
            }
        ]
        
        self.mock_traffic_incidents.insert_many(concurrent_incidents)
        
        summary = get_daily_traffic_summary(self.test_date)
        incidents = summary['incidents']
        
        # Verify both incidents are counted
        self.assertEqual(incidents['morning_incidents'], 3)  # Original + 2 concurrent
        self.assertEqual(incidents['total_count'], 4)       # All incidents

if __name__ == '__main__':
    unittest.main()