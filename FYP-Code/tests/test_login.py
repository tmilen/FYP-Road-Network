import unittest
from flask import json
from pymongo import MongoClient
from unittest.mock import patch, MagicMock
import bcrypt
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestLogin(unittest.TestCase):
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

        # Setup database collection access
        cls.db.__getitem__.side_effect = lambda x: {
            'users': cls.users_collection
        }.get(x, MagicMock())

        cls.mock_user = {
            "username": "test_user",
            "password": bcrypt.hashpw("password123".encode('utf-8'), bcrypt.gensalt()),
            "user_profile": "traffic_management_user"
        }

        def mock_find_one(query):
            if query.get("username") == "test_user":
                return cls.mock_user
            return None

        cls.users_collection.find_one.side_effect = mock_find_one

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

    def test_login_success(self):
        response = self.client.post('/api/login', json={
            "username": "test_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'success')
        self.assertEqual(data['username'], 'test_user')
        self.assertEqual(data['role'], 'traffic_management_user')

    def test_login_incorrect_username(self):
        response = self.client.post('/api/login', json={
            "username": "wrong_user",
            "password": "password123"
        })
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['message'], 'Username or Password does not match')  # Updated message

    def test_login_incorrect_password(self):
        response = self.client.post('/api/login', json={
            "username": "test_user",
            "password": "wrong_password"
        })
        self.assertEqual(response.status_code, 401)
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'error')
        self.assertEqual(data['message'], 'Username or Password does not match')  # Updated message

if __name__ == '__main__':
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestLogin)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_login = Pass")
    else:
        print("\ntest_login = Fail")
