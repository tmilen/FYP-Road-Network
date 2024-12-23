import os
import sys
import unittest
from flask import json
from unittest.mock import MagicMock
from pymongo import MongoClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
h
from app import create_app

class TestLogout(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock(spec=MongoClient)
        cls.db = cls.mock_client['traffic-users']
        cls.users_collection = cls.db['users']

    def setUp(self):
        self.app = create_app(db_client=self.mock_client)
        self.client = self.app.test_client()

        with self.client.session_transaction() as sess:
            sess['username'] = 'test_user'
            sess['role'] = 'traffic_management_user'

    def test_logout(self):
        response = self.client.get('/api/logout')
        self.assertEqual(response.status_code, 200)

        data = json.loads(response.data)
        self.assertEqual(data['status'], 'logged out')

        with self.client.session_transaction() as sess:
            self.assertNotIn('username', sess)
            self.assertNotIn('role', sess)

if __name__ == '__main__':
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestLogout)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_logout = Pass")
    else:
        print("\ntest_logout = Fail")
