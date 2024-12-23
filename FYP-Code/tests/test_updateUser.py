import unittest
from flask import json
from pymongo import MongoClient
from unittest.mock import MagicMock
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app

class TestUpdateUser(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock(spec=MongoClient)
        cls.db = cls.mock_client['traffic-users']
        cls.users_collection = cls.db['users']

        cls.mock_users = []

        def mock_find_one(query=None, **kwargs):
            if query:
                for user in cls.mock_users:
                    if user.get("id") == query.get("id"):
                        return user
            return None

        def mock_update_one(filter, update, **kwargs):
            for user in cls.mock_users:
                if user.get("id") == filter.get("id"):
                    user.update(update["$set"])
                    return MagicMock(matched_count=1, modified_count=1)
            return MagicMock(matched_count=0, modified_count=0)

        cls.users_collection.find_one.side_effect = mock_find_one
        cls.users_collection.update_one.side_effect = mock_update_one

    def setUp(self):
        self.app = create_app(db_client=self.mock_client)
        self.client = self.app.test_client()

        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

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
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestUpdateUser)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_update_user = Pass")
    else:
        print("\ntest_update_user = Fail")
