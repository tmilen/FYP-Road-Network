# User story 41

import unittest
from flask import json
from unittest.mock import MagicMock, patch
import bcrypt
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestChangePassword(unittest.TestCase):
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

        # Setup database collection access
        cls.db.__getitem__.side_effect = lambda x: {
            'users': cls.users_collection
        }.get(x, MagicMock())

        cls.mock_user = {
            "username": "test_user",
            "password": bcrypt.hashpw("current_password".encode('utf-8'), bcrypt.gensalt()),
            "email": "test_user@example.com",
            "first_name": "Test",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
            "user_profile": "traffic_management_user"
        }

        def mock_find_one(query):
            if query.get("username") == cls.mock_user["username"]:
                return cls.mock_user
            return None

        def mock_update_one(filter, update, **kwargs):
            if filter.get("username") == cls.mock_user["username"]:
                cls.mock_user["password"] = update["$set"]["password"]
                return MagicMock(matched_count=1, modified_count=1)
            return MagicMock(matched_count=0, modified_count=0)

        cls.users_collection.find_one.side_effect = mock_find_one
        cls.users_collection.update_one.side_effect = mock_update_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

            with self.client.session_transaction() as sess:
                sess['username'] = 'test_user'

    def test_change_password_success(self):
        response = self.client.post('/api/change-password', json={
            "currentPassword": "current_password",
            "newPassword": "new_password"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Password updated successfully')

        self.assertTrue(bcrypt.checkpw("new_password".encode('utf-8'), self.mock_user["password"]))

    def test_change_password_incorrect_current(self):
        response = self.client.post('/api/change-password', json={
            "currentPassword": "wrong_password",
            "newPassword": "new_password"
        })
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Current password does not match')  # Changed to match app's message

    def test_change_password_same_as_current(self):
        response = self.client.post('/api/change-password', json={
            "currentPassword": "current_password",
            "newPassword": "current_password"
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'New password cannot be the same as the current password')

if __name__ == '__main__':
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestChangePassword)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_change_password = Pass")
    else:
        print("\ntest_change_password = Fail")

