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

class TestDeleteProfile(unittest.TestCase):
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

        def mock_delete_one(query):
            profile_name = query.get('user_profile')
            if profile_name == 'test_profile':
                return MagicMock(deleted_count=1)
            return MagicMock(deleted_count=0)

        cls.profiles_collection.delete_one.side_effect = mock_delete_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

    def test_delete_profile_unauthorized(self):
        """Test deleting profile without proper authorization"""
        response = self.client.delete('/api/profiles/test_profile')
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Unauthorized')

    def test_delete_profile_success(self):
        """Test successful profile deletion"""
        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

        response = self.client.delete('/api/profiles/test_profile')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile deleted successfully')

    def test_delete_profile_not_found(self):
        """Test deleting non-existent profile"""
        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

        response = self.client.delete('/api/profiles/nonexistent_profile')
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile not found')

if __name__ == '__main__':
    unittest.main()
