import unittest
from flask import json
from unittest.mock import MagicMock, patch
import sys
import os
import io
from bson import ObjectId
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Mock APScheduler
sys.modules['apscheduler.schedulers.background'] = MagicMock()
sys.modules['apscheduler'] = MagicMock()

from app import create_app

class TestUploadFile(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create main mock client with dictionary access support
        cls.mock_client = MagicMock()
        cls.mock_client.__getitem__.side_effect = lambda x: {
            'traffic-users': cls.db,
            'TSUN-TESTING': cls.mock_gridfs_db
        }.get(x, MagicMock())
        
        # Initialize database mocks
        cls.db = MagicMock()
        cls.mock_gridfs_db = MagicMock()
        cls.fs = MagicMock()

        # Sample valid XML content
        cls.valid_xml = '''<?xml version="1.0" encoding="UTF-8"?>
        <town>
            <map width="800" height="600">
                <routes>
                    <route id="route1" type="road">
                        <start x="0" y="0"/>
                        <end x="100" y="100"/>
                    </route>
                </routes>
                <svg xmlns="http://www.w3.org/2000/svg">
                    <path id="path1" d="M0 0 L100 100"/>
                </svg>
            </map>
        </town>
        '''

        # Mock GridFS put method
        cls.fs.put.return_value = ObjectId()

    def setUp(self):
        # Mock GridFS
        with patch('gridfs.GridFS', return_value=self.fs):
            self.app = create_app(db_client=self.mock_client)
            self.client = self.app.test_client()

            with self.client.session_transaction() as sess:
                sess['username'] = 'test_user'
                sess['role'] = 'system_admin'

    def test_upload_file_success(self):
        """Test successful file upload"""
        data = {
            'file': (io.BytesIO(self.valid_xml.encode()), 'test.xml')
        }
        response = self.client.post('/api/upload',
                                  data=data,
                                  content_type='multipart/form-data')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'File uploaded successfully')
        self.assertIn('file_id', data)

    def test_upload_file_unauthorized(self):
        """Test unauthorized file upload"""
        with self.client.session_transaction() as sess:
            sess.clear()

        data = {
            'file': (io.BytesIO(self.valid_xml.encode()), 'test.xml')
        }
        response = self.client.post('/api/upload',
                                  data=data,
                                  content_type='multipart/form-data')
        self.assertEqual(response.status_code, 403)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Unauthorized')

    def test_upload_file_no_file(self):
        """Test upload with no file"""
        response = self.client.post('/api/upload',
                                  data={},
                                  content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'No file part')

    def test_upload_invalid_file_type(self):
        """Test upload with invalid file type"""
        data = {
            'file': (io.BytesIO(b'invalid content'), 'test.txt')
        }
        response = self.client.post('/api/upload',
                                  data=data,
                                  content_type='multipart/form-data')
        self.assertEqual(response.status_code, 400)
        data = json.loads(response.data)
        self.assertEqual(data['message'], 'Only XML files are allowed')

if __name__ == '__main__':
    unittest.main()
