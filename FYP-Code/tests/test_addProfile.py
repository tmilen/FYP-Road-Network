import unittest
from flask import json
from unittest.mock import MagicMock
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app

class TestAddProfile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mock_client = MagicMock()
        cls.profiles_collection = cls.mock_client['traffic-users']['profiles']

        cls.mock_profiles = []

        def mock_find_one(query=None):
            profile_name = query.get('user_profile') if query else None
            for profile in cls.mock_profiles:
                if profile.get('user_profile') == profile_name:
                    return profile
            return None

        def mock_insert_one(data):
            cls.mock_profiles.append({"user_profile": data.get("user_profile")})
            return MagicMock(inserted_id="mock_id")

        cls.profiles_collection.find_one.side_effect = mock_find_one
        cls.profiles_collection.insert_one.side_effect = mock_insert_one

    def setUp(self):
        # Create a test client using the mocked app
        self.app = create_app(db_client=self.mock_client)
        self.client = self.app.test_client()

        with self.client.session_transaction() as sess:
            sess['username'] = 'admin_user'
            sess['role'] = 'system_admin'

    def test_add_profile_success(self):
        response = self.client.post('/api/profiles', json={
            "user_profile": "new_profile"
        })
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile created successfully')

        added_profile = next(profile for profile in self.mock_profiles if profile["user_profile"] == "new_profile")
        self.assertEqual(added_profile["user_profile"], "new_profile")

    def test_add_profile_existing(self):
        # Add a mock profile to simulate an existing profile
        self.mock_profiles.append({
            "user_profile": "existing_profile"
        })

        response = self.client.post('/api/profiles', json={
            "user_profile": "existing_profile"
        })
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Profile already exists')

if __name__ == '__main__':
    test_suite = unittest.TestLoader().loadTestsFromTestCase(TestAddProfile)
    result = unittest.TextTestRunner(verbosity=2).run(test_suite)

    if result.wasSuccessful():
        print("\ntest_add_profile = Pass")
    else:
        print("\ntest_add_profile = Fail")
