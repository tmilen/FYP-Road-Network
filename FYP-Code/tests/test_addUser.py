import unittest
from flask import json
from pymongo import MongoClient
from unittest.mock import MagicMock, patch
import bcrypt
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestAddUser(unittest.TestCase):
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

        # Configure GridFS mock
        cls.mock_gridfs_db.get_database = MagicMock()

        # Mock users collection methods
        def mock_user_find_one(query=None, **kwargs):
            if not query:
                return None
                
            # Handle getting last user ID
            sort = kwargs.get('sort')
            if sort:
                key, direction = sort[0]
                if key == "id" and direction == -1:
                    if not cls.mock_users:
                        return None
                    return max(cls.mock_users, key=lambda u: u.get('id', 0))

            # Handle username lookup
            username = query.get('username')
            if username:
                return next((u for u in cls.mock_users if u.get('username') == username), None)
            
            return None

        def mock_user_insert_one(data):
            cls.mock_users.append(data)
            return MagicMock(inserted_id="mock_id")

        cls.users_collection.find_one.side_effect = mock_user_find_one
        cls.users_collection.insert_one.side_effect = mock_user_insert_one

        # Mock profiles collection methods
        def mock_profile_find_one(query=None):
            if not query:
                return None
            if query.get('user_profile') == 'system_admin':
                return {
                    'user_profile': 'system_admin',
                    'permissions': {'manage_users': True}
                }
            return None

        cls.profiles_collection.find_one.side_effect = mock_profile_find_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()
            self.mock_users.clear()  # Clear users before each test

            # Set up admin session
            with self.client.session_transaction() as sess:
                sess['username'] = 'admin_user'
                sess['role'] = 'system_admin'

            # Add admin user to mock database
            self.mock_users.append({
                'id': 1,
                'username': 'admin_user',
                'user_profile': 'system_admin'
            })

    def test_add_user_success(self):
        """Test successful user creation"""
        response = self.client.post('/api/users', json={
            "username": "new_user",
            "password": "password123",
            "email": "new_user@example.com",
            "first_name": "New",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
            "user_profile": "traffic_management_user"
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'User created successfully')
        self.assertIn('user', data)

    def test_add_user_existing_username(self):
        """Test adding user with existing username"""
        # First add a user
        self.mock_users.append({
            "id": 2,
            "username": "existing_user",
            "password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
            "email": "existing_user@example.com",
        })

        # Try to add user with same username
        response = self.client.post('/api/users', json={
            "username": "existing_user",
            "password": "password123",
            "email": "new_email@example.com",
            "first_name": "Existing",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
            "user_profile": "traffic_management_user"
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Username already exists')

if __name__ == '__main__':
    unittest.main()
