import unittest
from flask import json
from unittest.mock import MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock the apscheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestAddProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock()
        cls.profiles_collection = cls.mock_client['traffic-users']['profiles']
        cls.mock_profiles = []

        # Mock the GridFS database
        cls.mock_client['TSUN-TESTING'] = MagicMock()
        cls.mock_client['TSUN-TESTING'].get_database = MagicMock()

        def mock_find_one(query=None):
            profile_name = query.get('user_profile') if query else None
            return next((p for p in cls.mock_profiles if p.get('user_profile') == profile_name), None)

        def mock_insert_one(data):
            cls.mock_profiles.append({"user_profile": data.get("user_profile")})
            return MagicMock(inserted_id="mock_id")

        cls.profiles_collection.find_one.side_effect = mock_find_one
        cls.profiles_collection.insert_one.side_effect = mock_insert_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()
            self.mock_profiles.clear()  # Clear profiles before each test

    def test_add_profile_unauthorized(self):
        """Test adding profile without proper authorization"""
        response = self.client.post('/api/profiles', json={
            "user_profile": "test_profile"
        })
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Unauthorized')

    def test_add_profile_success(self):
        """Test successful profile creation"""
        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

        response = self.client.post('/api/profiles', json={
            "user_profile": "new_profile"
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile created successfully')

    def test_add_profile_missing_name(self):
        """Test adding profile with missing name"""
        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

        response = self.client.post('/api/profiles', json={
            "user_profile": ""
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile name is required')

    def test_add_profile_duplicate(self):
        """Test adding a profile that already exists"""
        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

        # First add a profile
        self.mock_profiles.append({"user_profile": "existing_profile"})

        # Try to add the same profile again
        response = self.client.post('/api/profiles', json={
            "user_profile": "existing_profile"
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile already exists')

if __name__ == '__main__':
    unittest.main()
