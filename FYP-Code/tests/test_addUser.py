import unittest
from flask import json
from pymongo import MongoClient
from unittest.mock import MagicMock
import bcrypt
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app

class TestAddUser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock(spec=MongoClient)
        cls.db = cls.mock_client['traffic-users']
        cls.users_collection = cls.db['users']

        cls.mock_users = []

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
        self.app = create_app(db_client=self.mock_client)
        self.client = self.app.test_client()

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
