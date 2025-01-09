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

class TestDeleteUser(unittest.TestCase):
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
        cls.users_collection = MagicMock()
        cls.permissions_collection = MagicMock()

        # Setup database collection access
        cls.db.__getitem__.side_effect = lambda x: {
            'users': cls.users_collection,
            'user_permissions': cls.permissions_collection
        }.get(x, MagicMock())

        def mock_delete_one(query):
            user_id = query.get('id')
            if user_id == 1:
                return MagicMock(deleted_count=1)
            return MagicMock(deleted_count=0)

        cls.users_collection.delete_one.side_effect = mock_delete_one
        cls.permissions_collection.delete_one.side_effect = mock_delete_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

            with self.client.session_transaction() as sess:
                sess['username'] = 'admin_user'
                sess['role'] = 'system_admin'

    def test_delete_user_success(self):
        """Test successful user deletion"""
        response = self.client.delete('/api/users/1')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'User deleted successfully')

    def test_delete_user_not_found(self):
        """Test deleting non-existent user"""
        response = self.client.delete('/api/users/999')
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'User not found')

    def test_delete_user_unauthorized(self):
        """Test deleting user without proper authorization"""
        with self.client.session_transaction() as sess:
            sess.pop('username', None)
            sess.pop('role', None)

        response = self.client.delete('/api/users/1')
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Unauthorized')

if __name__ == '__main__':
    unittest.main()
