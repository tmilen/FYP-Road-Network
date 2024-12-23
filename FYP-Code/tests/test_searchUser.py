import unittest
from flask import json
from unittest.mock import MagicMock
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app

class TestGetAllUsers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock()
        cls.users_collection = cls.mock_client['traffic-users']['users']

        cls.mock_users = [
            {
                "username": "john_doe",
                "email": "john@example.com",
                "first_name": "John",
                "last_name": "Doe"
            },
            {
                "username": "jane_smith",
                "email": "jane@example.com",
                "first_name": "Jane",
                "last_name": "Smith"
            }
        ]

    def setUp(self):
        self.app = create_app(db_client=self.mock_client)
        self.client = self.app.test_client()

    def test_get_all_users_with_query(self):
        self.users_collection.find.return_value = [self.mock_users[0]]

        response = self.client.get('/api/users?query=John')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["username"], "john_doe")
        self.assertEqual(data[0]["email"], "john@example.com")

if __name__ == '__main__':
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestGetAllUsers)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_get_all_users = Pass")
    else:
        print("\ntest_get_all_users = Fail")
