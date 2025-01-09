import os
import sys
import unittest
from flask import json
from unittest.mock import MagicMock, patch
from pymongo import MongoClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestLogout(unittest.TestCase):
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

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
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
