import unittest
from flask import json
from unittest.mock import MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler before importing app
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestGetAllUsers(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create main mock client with dictionary access support
        cls.mock_client = MagicMock()
        cls.db = MagicMock()
        cls.mock_gridfs_db = MagicMock()
        cls.users_collection = MagicMock()
        cls.profiles_collection = MagicMock()

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

        # Mock user data
        cls.mock_users = [
            {
                "id": 1,
                "username": "john_doe",
                "email": "john@example.com",
                "first_name": "John",
                "last_name": "Doe",
                "user_profile": "traffic_analyst"
            },
            {
                "id": 2,
                "username": "jane_smith",
                "email": "jane@example.com",
                "first_name": "Jane",
                "last_name": "Smith",
                "user_profile": "traffic_management_user"
            }
        ]

        # Mock profile permissions
        cls.mock_profiles = {
            "traffic_analyst": {
                "permissions": {
                    "traffic_management": True,
                    "data_health": False,
                    "manage_users": False
                }
            },
            "traffic_management_user": {
                "permissions": {
                    "traffic_management": True,
                    "data_health": False,
                    "manage_users": False
                }
            }
        }

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS') as mock_gridfs:
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

            # Mock find method for users collection
            def mock_users_find(query=None, projection=None):
                # Handle case with no query (return all users)
                if not query or not query.get('$or'):
                    return self.mock_users

                # Extract search terms from query
                search_conditions = query.get('$or', [])
                filtered_users = []
                
                for user in self.mock_users:
                    # Check each user against all search conditions
                    for condition in search_conditions:
                        field = list(condition.keys())[0]  # Get field name (username, email, etc.)
                        regex = condition[field].get('$regex', '')
                        
                        # Get the user field value to compare
                        user_value = str(user.get(field, '')).lower()
                        search_value = str(regex).lower()
                        
                        # If any condition matches, add user to results
                        if search_value in user_value:
                            filtered_users.append(user)
                            break
                
                return filtered_users

            # Mock find_one method for profiles collection
            def mock_profile_find_one(query=None, projection=None):
                if query and "user_profile" in query:
                    profile_name = query["user_profile"]
                    if profile_name in self.mock_profiles:
                        return {
                            "user_profile": profile_name,
                            "permissions": self.mock_profiles[profile_name]["permissions"]
                        }
                return None

            self.users_collection.find = MagicMock(side_effect=mock_users_find)
            self.profiles_collection.find_one = MagicMock(side_effect=mock_profile_find_one)

    def test_get_all_users_with_query(self):
        """Test getting users with search query"""
        response = self.client.get('/api/users?query=John')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["username"], "john_doe")
        self.assertEqual(data[0]["email"], "john@example.com")
        self.assertEqual(data[0]["user_profile"], "traffic_analyst")
        self.assertIn("permissions", data[0])

    def test_get_all_users_no_query(self):
        """Test getting all users without query"""
        response = self.client.get('/api/users')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(len(data), 2)
        self.assertIn("permissions", data[0])
        self.assertIn("permissions", data[1])

if __name__ == '__main__':
    unittest.main()
