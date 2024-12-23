# User story 41

import unittest
from flask import json
from unittest.mock import MagicMock
import bcrypt
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app

class TestChangePassword(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock()
        cls.users_collection = cls.mock_client['traffic-users']['users']

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
        self.assertEqual(data['message'], 'Current password is incorrect')

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

