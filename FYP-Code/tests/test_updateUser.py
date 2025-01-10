import unittest
from flask import json
from pymongo import MongoClient
from unittest.mock import MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestUpdateUser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create main mock client with dictionary access support
        cls.mock_client = MagicMock(spec=MongoClient)
        cls.db = MagicMock()
        cls.mock_gridfs_db = MagicMock()
        cls.users_collection = MagicMock()
        cls.profiles_collection = MagicMock()
        cls.mock_users = []

        # Setup mock database structure
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'traffic-users': cls.db,
            'TSUN-TESTING': cls.mock_gridfs_db
        }.get(x, MagicMock())

        # Setup collections
        cls.db.__getitem__.side_effect = lambda x: {
            'users': cls.users_collection,
            'profiles': cls.profiles_collection
        }.get(x, MagicMock())

        def mock_user_find_one(query=None, **kwargs):
            if query is None:
                return None

            # Handle username lookup for admin
            if query.get('username') == 'admin_user':
                return {
                    'id': 999,
                    'username': 'admin_user',
                    'user_profile': 'system_admin'
                }

            # Handle user ID lookup
            user_id = query.get('id')
            if user_id:
                return next((u for u in cls.mock_users if u.get('id') == user_id), None)

            return None

        def mock_profile_find_one(query=None, **kwargs):
            if query and query.get('user_profile') == 'system_admin':
                return {
                    'user_profile': 'system_admin',
                    'permissions': {'manage_users': True}
                }
            return None

        def mock_update_one(filter_dict, update_dict, **kwargs):
            user_id = filter_dict.get('id')
            if user_id:
                user = next((u for u in cls.mock_users if u.get('id') == user_id), None)
                if user:
                    user.update(update_dict['$set'])
                    return MagicMock(matched_count=1, modified_count=1)
            return MagicMock(matched_count=0, modified_count=0)

        cls.users_collection.find_one.side_effect = mock_user_find_one
        cls.users_collection.update_one.side_effect = mock_update_one
        cls.profiles_collection.find_one.side_effect = mock_profile_find_one

    def setUp(self):
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()
            self.mock_users.clear()

            # Set up admin session
            with self.client.session_transaction() as sess:
                sess['username'] = 'admin_user'
                sess['role'] = 'system_admin'

            # Add test user
            self.mock_users.append({
                "id": 1,
                "username": "existing_user",
                "email": "existing_user@example.com",
                "first_name": "Existing",
                "last_name": "User",
                "date_of_birth": "2000-01-01",
                "user_profile": "traffic_management_user"
            })

    def test_update_user_success(self):
        response = self.client.put('/api/users/1', json={
            "email": "updated_user@example.com",
            "first_name": "Updated",
            "last_name": "User"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'User updated successfully')

        updated_user = next(user for user in self.mock_users if user["id"] == 1)
        self.assertEqual(updated_user["email"], "updated_user@example.com")
        self.assertEqual(updated_user["first_name"], "Updated")
        self.assertEqual(updated_user["last_name"], "User")

    def test_update_user_not_found(self):
        response = self.client.put('/api/users/999', json={
            "email": "nonexistent_user@example.com"
        })
        self.assertEqual(response.status_code, 404)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'User not found or no changes made')

if __name__ == '__main__':
    unittest.main()
