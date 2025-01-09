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
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'traffic-users': cls.db,
            'TSUN-TESTING': cls.mock_gridfs_db
        }.get(x, MagicMock())
        
        # Initialize database mocks
        cls.db = MagicMock()
        cls.mock_gridfs_db = MagicMock()
        cls.users_collection = MagicMock()
        cls.mock_users = []

        # Setup database collection access
        cls.db.__getitem__.side_effect = lambda x: {
            'users': cls.users_collection
        }.get(x, MagicMock())

        # Configure GridFS mock
        cls.mock_gridfs_db.get_database = MagicMock()

        def mock_find_one(query=None, **kwargs):
            sort = kwargs.get('sort')
            if sort:
                key, direction = sort[0]
                if key == "id" and direction == -1:
                    return max(cls.mock_users, key=lambda u: u.get('id', 0), default=None)
            if query:
                username = query.get('username')
                for user in cls.mock_users:
                    if user.get('username') == username:
                        return user
            return None

        def mock_insert_one(data):
            cls.mock_users.append(data)
            return MagicMock(inserted_id="mock_id")

        cls.users_collection.find_one.side_effect = mock_find_one
        cls.users_collection.insert_one.side_effect = mock_insert_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()
            self.mock_users.clear()  # Clear users before each test

            with self.client.session_transaction() as sess:
                sess['username'] = 'admin_user'
                sess['role'] = 'system_admin'

    def test_add_user_success(self):
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
        self.assertEqual(data['message'], 'User created successfully with permissions')

    def test_add_user_existing_username(self):
        self.mock_users.append({
            "id": 1,
            "username": "existing_user",
            "password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
            "email": "existing_user@example.com",
            "first_name": "Existing",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
            "user_profile": "traffic_management_user"
        })

        response = self.client.post('/api/users', json={
            "username": "existing_user",
            "password": "password123",
            "email": "existing_user@example.com",
            "first_name": "Existing",
            "last_name": "User",
            "date_of_birth": "2000-01-01",
            "user_profile": "traffic_management_user"
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Username already exists')

if __name__ == '__main__':
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestAddUser)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_add_user = Pass")
    else:
        print("\ntest_add_user = Fail")
