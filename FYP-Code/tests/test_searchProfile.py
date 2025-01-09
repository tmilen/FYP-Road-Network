import unittest
from flask import json
from unittest.mock import MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestSearchProfile(unittest.TestCase):
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
        cls.profiles_collection = MagicMock()

        # Setup database collection access
        cls.db.__getitem__.side_effect = lambda x: {
            'profiles': cls.profiles_collection
        }.get(x, MagicMock())

        cls.mock_profiles = [
            {"user_profile": "system_admin"},
            {"user_profile": "traffic_analyst"},
            {"user_profile": "traffic_management_user"}
        ]

        def mock_find(query=None):
            search_term = query.get("user_profile", {}).get("$regex", "")
            if search_term:
                return [p for p in cls.mock_profiles 
                       if search_term.lower() in p["user_profile"].lower()]
            return cls.mock_profiles

        cls.profiles_collection.find.return_value = mock_find({})

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

    def test_search_profiles_no_query(self):
        """Test getting all profiles without search query"""
        self.profiles_collection.find.return_value = self.mock_profiles
        
        response = self.client.get('/api/search-profiles')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 3)
        self.assertEqual(data[0]["user_profile"], "system_admin")

    def test_search_profiles_with_query(self):
        """Test searching profiles with query parameter"""
        filtered_profiles = [p for p in self.mock_profiles 
                           if "traffic" in p["user_profile"].lower()]
        self.profiles_collection.find.return_value = filtered_profiles
        
        response = self.client.get('/api/search-profiles?query=traffic')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(len(data), 2)
        self.assertTrue(all("traffic" in p["user_profile"].lower() for p in data))

if __name__ == '__main__':
    unittest.main()
