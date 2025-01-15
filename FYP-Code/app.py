from flask import Flask, request, session, jsonify, make_response, send_file
from pymongo import MongoClient, UpdateOne
import gridfs
from flask_cors import CORS
import bcrypt
from bson import ObjectId
import os
from dotenv import load_dotenv
from werkzeug.utils import secure_filename
from xml.etree import ElementTree as ET
from datetime import datetime, timedelta
import pytz
import requests
from apscheduler.schedulers.background import BackgroundScheduler
import pandas as pd
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib.enums import TA_CENTER, TA_RIGHT
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.graphics.shapes import Drawing, Line
from datetime import datetime

load_dotenv()
def create_app(db_client=None):
    app = Flask(__name__)
    
    CORS(app, supports_credentials=True, resources={r"/*": {"origins": "http://127.0.0.1:3000"}})
    client = db_client or MongoClient(os.getenv("MONGODB_URI"))
    app.secret_key = os.getenv('SECRET_KEY', 'fyp_key')
    tomtom_api_key = os.getenv('TOMTOM_API_KEY')

    db = client['traffic-users']
    users_collection = db['users']
    profiles_collection = db['profiles']
    user_permissions_collection = db['user_permissions']

    # Create a GridFS instance for file storage
    fs = gridfs.GridFS(client['TSUN-TESTING'], collection='maps-upload')

    # Add collection for historical traffic data
    historical_traffic_data = client['TSUN-TESTING']['historical_traffic_data']

        # Add timezone configuration
    SGT = pytz.timezone('Asia/Singapore')

    def get_sgt_time():
        return datetime.now(SGT)

    # Read roads from file and initialize SINGAPORE_ROADS
    SINGAPORE_ROADS = []
    try:
        with open('FlowX/src/roads.txt', 'r') as f:
            for line in f:
                if line.strip():  # Skip empty lines
                    name, lat, lng = line.strip().split(',')
                    SINGAPORE_ROADS.append({
                        "name": name,
                        "lat": float(lat),
                        "lng": float(lng)
                    })
        print(f"[DEBUG] Loaded {len(SINGAPORE_ROADS)} roads from file")
    except Exception as e:
        print(f"Error reading roads file: {e}")
        SINGAPORE_ROADS = []  # Fallback to empty list if file read fails

    # Add new collection for current traffic data
    current_traffic_data = client['TSUN-TESTING']['current_traffic_data']

    # Add new collection for traffic incidents
    traffic_incidents = client['TSUN-TESTING']['traffic_incidents']

    def fetch_current_traffic():
        """Fetch current traffic data for all roads"""
        try:
            print(f"[DEBUG] Using TomTom API Key: {tomtom_api_key}")
            
            # First, verify the API key is valid
            test_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=1.3521,103.8198&key={tomtom_api_key}"
            test_response = requests.get(test_url)
            
            if (test_response.status_code == 403):
                print(f"[API ERROR] Invalid or expired API key. Status: {test_response.status_code}")
                print(f"[API ERROR] Response: {test_response.text}")
                return False
            
            bulk_updates = []
            current_time = get_sgt_time()
            expected_road_count = len(SINGAPORE_ROADS)
            print(f"Updating traffic data. Expecting {expected_road_count} records")
            
            api_success_count = 0
            api_failed_count = 0
            
            for road in SINGAPORE_ROADS:
                try:
                    tomtom_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={road['lat']},{road['lng']}&key={tomtom_api_key}"
                    
                    print(f"[API DEBUG] Requesting data for {road['name']}")
                    flow_response = requests.get(tomtom_url)
                    
                    if flow_response.status_code == 200:
                        api_success_count += 1
                        print(f"[API SUCCESS] {road['name']} - Status: {flow_response.status_code}")
                        
                        flow_data = flow_response.json()
                        current_speed = flow_data['flowSegmentData'].get('currentSpeed', 0)
                        free_flow_speed = flow_data['flowSegmentData'].get('freeFlowSpeed', 0)
                        
                        # Calculate intensity
                        speed_ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 0
                        if speed_ratio > 0.8:
                            intensity = 'low'
                        elif speed_ratio > 0.5:
                            intensity = 'medium'
                        else:
                            intensity = 'high'
                        
                        road_id = f"road_{SINGAPORE_ROADS.index(road) + 1}"
                        
                        update_data = {
                            'streetName': road['name'],
                            'coordinates': {
                                'lat': road['lat'],
                                'lng': road['lng']
                            },
                            'date': current_time.strftime('%d-%m-%Y'),
                            'time': current_time.strftime('%H:%M'),
                            'lastUpdated': current_time,
                            'currentSpeed': current_speed,
                            'freeFlowSpeed': free_flow_speed,
                            'intensity': intensity
                        }
                        
                        bulk_updates.append(
                            UpdateOne(
                                {'road_id': road_id},
                                {'$set': update_data},
                                upsert=True
                            )
                        )
                    else:
                        api_failed_count += 1
                        print(f"[API ERROR] {road['name']} - Response validation failed")
                        print(f"Flow Response: {flow_response.text}")

                except Exception as e:
                    api_failed_count += 1
                    print(f"[API ERROR] {road['name']} - Exception: {str(e)}")
                    continue

            if bulk_updates:
                result = current_traffic_data.bulk_write(bulk_updates)
                print(f"\n[API SUMMARY] Total Roads: {len(SINGAPORE_ROADS)}")
                print(f"[API SUMMARY] Successful Updates: {api_success_count}")
                print(f"[API SUMMARY] Failed Updates: {api_failed_count}")
                print(f"[API SUMMARY] Modified: {result.modified_count}")
                print(f"[API SUMMARY] Upserted: {result.upserted_count}")
                return True
            
            print("[API WARNING] No traffic data was collected")
            return False

        except Exception as e:
            print(f"[CRITICAL ERROR] Error in fetch_current_traffic: {e}")
            return False

    def fetch_historical_traffic():
        """Fetch and store historical traffic data with incident tracking"""
        try:
            current_time = get_sgt_time()
            expected_total_records = len(SINGAPORE_ROADS) * 24
            print(f"[HISTORICAL] Collecting historical data. Expecting {expected_total_records} records")
            
            bulk_inserts = []
            bulk_incidents = []
            api_success_count = 0
            api_failed_count = 0
            
            for hours_ago in range(24, 0, -1):
                timestamp = current_time - timedelta(hours=hours_ago)
                print(f"\n[HISTORICAL] Processing data for: {timestamp}")
                
                for road in SINGAPORE_ROADS:
                    try:
                        tomtom_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={road['lat']},{road['lng']}&key={tomtom_api_key}"
                        flow_response = requests.get(tomtom_url)
                        
                        if flow_response.status_code == 200:
                            api_success_count += 1
                            traffic_info = flow_response.json()
                            
                            current_speed = traffic_info['flowSegmentData']['currentSpeed']
                            free_flow_speed = traffic_info['flowSegmentData']['freeFlowSpeed']
                            
                            speed_ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 0
                            if speed_ratio > 0.8:
                                intensity = 'low'
                            elif speed_ratio > 0.5:
                                intensity = 'medium'
                            else:
                                intensity = 'high'
                            
                            road_id = f"road_{SINGAPORE_ROADS.index(road) + 1}"

                            # Record incidents if conditions are met
                            if intensity == 'high':
                                incident_doc = {
                                    'road_id': road_id,
                                    'streetName': road['name'],
                                    'coordinates': {
                                        'lat': road['lat'],
                                        'lng': road['lng']
                                    },
                                    'type': 'CONGESTION',
                                    'severity': 3,
                                    'description': f'Heavy traffic detected - Speed {current_speed}km/h',
                                    'start_time': timestamp,
                                    'recorded_at': timestamp,
                                    'status': 'HISTORICAL',
                                    'speed_ratio': speed_ratio
                                }
                                bulk_incidents.append(incident_doc)

                            # Record potential accidents
                            if speed_ratio < 0.3:
                                incident_doc = {
                                    'road_id': road_id,
                                    'streetName': road['name'],
                                    'coordinates': {
                                        'lat': road['lat'],
                                        'lng': road['lng']
                                    },
                                    'type': 'ACCIDENT',
                                    'severity': 4,
                                    'description': f'Possible accident detected - Severe slowdown to {current_speed}km/h',
                                    'start_time': timestamp,
                                    'recorded_at': timestamp,
                                    'status': 'HISTORICAL',
                                    'speed_ratio': speed_ratio
                                }
                                bulk_incidents.append(incident_doc)
                            
                            historical_record = {
                                'road_id': road_id,
                                'streetName': road['name'],
                                'coordinates': {
                                    'lat': road['lat'],
                                    'lng': road['lng']
                                },
                                'date': timestamp.strftime('%d-%m-%Y'),
                                'time': timestamp.strftime('%H:%M'),
                                'timestamp': timestamp,
                                'currentSpeed': current_speed,
                                'freeFlowSpeed': free_flow_speed,
                                'intensity': intensity
                            }
                            
                            bulk_inserts.append(historical_record)
                            
                        else:
                            api_failed_count += 1
                            print(f"[HISTORICAL ERROR] {road['name']} - Failed with status: {flow_response.status_code}")

                    except Exception as e:
                        api_failed_count += 1
                        print(f"[HISTORICAL ERROR] {road['name']} - Exception: {str(e)}")
                        continue

            if bulk_inserts:
                # Insert historical records
                result = historical_traffic_data.insert_many(bulk_inserts)
                
                # Insert incidents if any
                if bulk_incidents:
                    traffic_incidents.insert_many(bulk_incidents)
                
                print(f"\n[HISTORICAL SUMMARY] Expected Records: {expected_total_records}")
                print(f"[HISTORICAL SUMMARY] Inserted: {len(result.inserted_ids)}")
                print(f"[HISTORICAL SUMMARY] Incidents Recorded: {len(bulk_incidents)}")
                print(f"[HISTORICAL SUMMARY] API Successes: {api_success_count}")
                print(f"[HISTORICAL SUMMARY] API Failures: {api_failed_count}\n")
                
                return True
            
            print("[HISTORICAL] No historical data was collected")
            return False

        except Exception as e:
            print(f"[HISTORICAL CRITICAL ERROR] Error in fetch_historical_traffic: {e}")
            return False

    def check_api_quota():
        """Check if the TomTom API key has exceeded its quota"""
        try:
            test_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=1.3521,103.8198&key={tomtom_api_key}"
            response = requests.get(test_url)
            
            if response.status_code == 403:
                error_msg = response.json().get('error', {}).get('description', '')
                if 'quota' in error_msg.lower() or 'exceeded' in error_msg.lower() or 'limit' in error_msg.lower():
                    print(f"[API QUOTA ERROR] {error_msg}")
                    return True
            return False
        except Exception as e:
            print(f"[API CHECK ERROR] {str(e)}")
            return True  # Return True as a precaution if we can't check

     # Initialize the scheduler
    scheduler = BackgroundScheduler(timezone="Asia/Singapore")
    
    @scheduler.scheduled_job('cron', id='fetch_current_traffic', minute='*/5', misfire_grace_time=300)
    def scheduled_current_traffic_fetch():
        try:
            if check_api_quota():
                print("[SCHEDULER] Skipping traffic fetch due to API quota limits")
                return
                
            current_time = get_sgt_time()
            print(f"[SCHEDULER DEBUG] Starting current traffic data fetch at {current_time}")
            fetch_current_traffic()
            print(f"[SCHEDULER DEBUG] Completed traffic fetch at {get_sgt_time()}")
        except Exception as e:
            print(f"[SCHEDULER ERROR] Error in traffic fetch: {e}")

    # Modify scheduler task to run every hour at minute 0 (e.g., 00:00, 01:00, 02:00)
    @scheduler.scheduled_job('cron', id='fetch_historical_traffic', hour='*', minute='0', misfire_grace_time=300)
    def scheduled_historical_traffic_fetch():
       try:
            if check_api_quota():
                print("[SCHEDULER] Skipping historical fetch due to API quota limits")
                return
                
            current_time = get_sgt_time()
            print(f"[SCHEDULER DEBUG] Starting hourly historical data fetch at {current_time}")
            fetch_historical_traffic()
            print(f"[SCHEDULER DEBUG] Completed historical fetch at {get_sgt_time()}")
       except Exception as e:
          print(f"[SCHEDULER ERROR] Error in historical fetch: {e}")

    # Add these lines to ensure scheduler is running with job count debug
    print("[SCHEDULER] Starting scheduler...")
    scheduler.print_jobs()
    pending_jobs = len(scheduler.get_jobs())
    print(f"[SCHEDULER] Total pending jobs: {pending_jobs}")
    print("[SCHEDULER] Job details:")
    for job in scheduler.get_jobs():
        try:
            next_run = job.trigger.get_next_fire_time(None, datetime.now()).strftime('%Y-%m-%d %H:%M:%S')
        except AttributeError:
            next_run = 'Not scheduled'
        print(f"- {job.id}: Next run at {next_run}")
    scheduler.start()
    print("[SCHEDULER] Scheduler started successfully")

    # Initialize current traffic data if collection is empty
    if current_traffic_data.count_documents({}) == 0:
        print("[INIT] No current traffic data found. Checking API quota before fetching...")
        if not check_api_quota():
            if fetch_current_traffic():
                print("[INIT] Successfully initialized current traffic data")
            else:
                print("[INIT ERROR] Failed to initialize current traffic data")
        else:
            print("[INIT ERROR] Cannot initialize data - API quota exceeded")

    # Initialize historical traffic data if collection is empty
    if historical_traffic_data.count_documents({}) == 0:
        print("[INIT] No historical traffic data found. Checking API quota before fetching...")
        if not check_api_quota():
            if fetch_historical_traffic():
                print("[INIT] Successfully initialized historical traffic data")
            else:
                print("[INIT ERROR] Failed to initialize historical traffic data")
        else:
            print("[INIT ERROR] Cannot initialize data - API quota exceeded")

    # Function to create default profiles if they don't exist
    def create_profiles():
        profiles = {
            'system_admin': {
                'user_profile': 'system_admin',
                'permissions': {
                    'traffic_management': True,
                    'data_health': True,
                    'manage_users': True,
                    'traffic_data': True,
                    'live_map': True,
                    'upload_map': True,
                    'report': True
                }
            },
            'traffic_analyst': {
                'user_profile': 'traffic_analyst',
                'permissions': {
                    'traffic_management': True,
                    'data_health': False,
                    'manage_users': False,
                    'traffic_data': True,
                    'live_map': True,
                    'upload_map': True,
                    'report': True
                }
            },
            'urban_planner': {
                'user_profile': 'urban_planner',
                'permissions': {
                    'traffic_management': True,
                    'data_health': False,
                    'manage_users': False,
                    'traffic_data': False,
                    'live_map': True,
                    'upload_map': True,
                    'report': False
                }
            },
            'data_engineer': {
                'user_profile': 'data_engineer',
                'permissions': {
                    'traffic_management': True,
                    'data_health': True,
                    'manage_users': False,
                    'traffic_data': False,
                    'live_map': False,
                    'upload_map': True,
                    'report': False
                }
            },
            'traffic_management_user': {
                'user_profile': 'traffic_management_user',
                'permissions': {
                    'traffic_management': True,
                    'data_health': False,
                    'manage_users': False,
                    'traffic_data': True,
                    'live_map': True,
                    'upload_map': False,
                    'report': True
                }
            }
        }

        existing_profiles = profiles_collection.distinct("user_profile")
        for profile_name, profile_data in profiles.items():
            if profile_name not in existing_profiles:
                profiles_collection.insert_one(profile_data)
        print("Default profiles created or verified.")

    # Helper function to get the next user ID
    def get_next_user_id():
        last_user = users_collection.find_one(sort=[("id", -1)])
        if last_user and 'id' in last_user:
            return last_user['id'] + 1
        return 1 

    # Function to create an admin user
    def create_admin_user():
        username = 'admin'
        password = 'admin123'
        email = 'admin@mail.com'
        first_name = 'admin'
        last_name = 'admin'
        date_of_birth = '2001-01-01'
        user_profile = 'system_admin'

        if users_collection.find_one({'username': username}):
            print("Admin user already exists.")
            return

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        users_collection.insert_one({
            'id': 1, 
            'username': username,
            'password': hashed_password,
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'date_of_birth': date_of_birth,
            'user_profile': user_profile
        })
        print("Admin user created successfully.")

        # Set admin permissions to all True
        user_permissions_collection.insert_one({
            'user_id': 1,
            'traffic_management': True,
            'data_health': True,
            'manage_users': True,
            'urban_planning': True
        })
        print("Admin permissions set to true for all features.")



    create_profiles()
    create_admin_user()

    # Credentials
    def check_credentials(username, password):
        user = users_collection.find_one({"username": username})
        if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
            return user
        return None

    # Login
    @app.route('/api/login', methods=['POST'])
    def login():
        data = request.json
        username = data.get('username')
        password = data.get('password')

        user = check_credentials(username, password)
        if user:
            session['username'] = user['username']
            session['role'] = user['user_profile']
            print(f"Debug: Session set for user {user['username']} with role {user['user_profile']}")
            return jsonify({'status': 'success', 'username': user['username'], 'role': user['user_profile']})
        else:
            return jsonify({'status': 'error', 'message': 'Username or Password does not match'}), 401


    # Logout
    @app.route('/api/logout', methods=['GET'])
    def logout():
        session.pop('username', None)
        session.pop('role', None)
        return jsonify({'status': 'logged out'})

    @app.route('/api/session', methods=['GET'])
    def get_session():
        if 'username' in session and 'role' in session:
            # Retrieve the user document
            user = users_collection.find_one(
                {"username": session['username']},
                {"_id": 0, "password": 0}
            )
            if user:
                # Get permissions from the user's profile instead of user_permissions
                profile = profiles_collection.find_one(
                    {"user_profile": user["user_profile"]},
                    {"_id": 0}
                )
                
                # Get permissions from profile, default to empty dict if not found
                permissions = profile.get('permissions', {}) if profile else {}

                print(f"Debug: User session active - Username: {user['username']}, Role: {user['user_profile']}, Permissions: {permissions}")

                return jsonify({
                    'username': user['username'],
                    'role': user['user_profile'],
                    'first_name': user.get('first_name', ''),
                    'last_name': user.get('last_name', ''),
                    'email': user.get('email', ''),
                    'date_of_birth': user.get('date_of_birth', ''),
                    'permissions': permissions  # Include retrieved permissions
                })
            else:
                print("Debug: User not found in the database")
                return jsonify({'message': 'User not found'}), 404
        else:
            print("Debug: No active session")
            return jsonify({'message': 'No active session'}), 401

    # Change password
    @app.route('/api/change-password', methods=['POST'])
    def change_password():
        if 'username' not in session:
            return jsonify({'message': 'Not logged in'}), 401

        data = request.json
        current_password = data.get('currentPassword')
        new_password = data.get('newPassword')

        # Find the user in the database
        user = users_collection.find_one({'username': session['username']})
        if not user or not bcrypt.checkpw(current_password.encode('utf-8'), user['password']):
            return jsonify({'message': 'Current password does not match'}), 401

        if bcrypt.checkpw(new_password.encode('utf-8'), user['password']):
            return jsonify({'message': 'New password cannot be the same as the current password'}), 400

        # Update the password
        hashed_new_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
        users_collection.update_one({'username': session['username']}, {'$set': {'password': hashed_new_password}})

        return jsonify({'message': 'Password updated successfully'}), 200


    # Get all users
    @app.route('/api/users', methods=['GET'])
    def get_all_users():
        query = request.args.get('query', '')
        base_query = {
            "$or": [
                {"username": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"first_name": {"$regex": query, "$options": "i"}},
                {"last_name": {"$regex": query, "$options": "i"}}
            ]
        }
        
        # Get users without password and _id
        users = list(users_collection.find(base_query, {"_id": 0, "password": 0}))
        
        # Add profile permissions for each user
        for user in users:
            profile = profiles_collection.find_one(
                {"user_profile": user["user_profile"]},
                {"_id": 0, "permissions": 1}
            )
            if profile:
                user["permissions"] = profile.get("permissions", {})
            else:
                user["permissions"] = {}
        
        return jsonify(users)

    # Add a new user
    @app.route('/api/users', methods=['POST'])
    def add_user():
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        # Get the user's profile and check manage_users permission
        user = users_collection.find_one({"username": session['username']})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        # Get permissions from user's profile
        profile = profiles_collection.find_one({"user_profile": user["user_profile"]})
        if not profile or not profile.get('permissions', {}).get('manage_users', False):
            return jsonify({'message': 'Insufficient permissions'}), 403

        data = request.json

        # Validate required fields
        required_fields = ['username', 'password', 'email', 'first_name', 'last_name', 'date_of_birth', 'user_profile']
        if not all(field in data for field in required_fields):
            return jsonify({'message': 'Missing required fields'}), 400

        # Check if username or email already exists
        if users_collection.find_one({'username': data['username']}):
            return jsonify({'message': 'Username already exists'}), 400
        if users_collection.find_one({'email': data['email']}):
            return jsonify({'message': 'Email already exists'}), 400

        try:
            # Get the next available user ID
            user_id = get_next_user_id()

            # Format the user profile name
            formatted_profile = data['user_profile'].lower().replace(' ', '_')

            # Hash password
            hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())

            # Create user document
            new_user = {
                'id': user_id,
                'username': data['username'],
                'password': hashed_password,
                'email': data['email'],
                'first_name': data['first_name'].capitalize(),
                'last_name': data['last_name'].capitalize(),
                'date_of_birth': data['date_of_birth'],
                'user_profile': formatted_profile  # Use formatted profile name
            }

            # Insert the new user
            result = users_collection.insert_one(new_user)

            # Create response object without password
            response_user = {
                'id': user_id,
                'username': new_user['username'],
                'email': new_user['email'],
                'first_name': new_user['first_name'],
                'last_name': new_user['last_name'],
                'date_of_birth': new_user['date_of_birth'],
                'user_profile': formatted_profile
            }

            return jsonify({
                'message': 'User created successfully',
                'user': response_user
            }), 201

        except Exception as e:
            print(f"Error creating user: {e}")
            return jsonify({'message': 'Error creating user'}), 500

    # Get all profiles with optional search query
    @app.route('/api/profiles', methods=['GET'])
    def get_all_profiles():
        query = request.args.get('query', '')
        profiles = list(profiles_collection.find(
            {"user_profile": {"$regex": query, "$options": "i"}},
            {"_id": 0}
        ))  
        return jsonify(profiles)

    # Add a new profile
    @app.route('/api/profiles', methods=['POST'])
    def add_profile():
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        # Get the user's profile and check manage_users permission
        user = users_collection.find_one({"username": session['username']})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        # Get permissions from user's profile
        profile = profiles_collection.find_one({"user_profile": user["user_profile"]})
        if not profile or not profile.get('permissions', {}).get('manage_users', False):
            return jsonify({'message': 'Insufficient permissions'}), 403

        data = request.json
        profile_name = data.get('user_profile')
        permissions = data.get('permissions', {})

        # Check if profile name is empty
        if not profile_name:
            return jsonify({'message': 'Profile name is required'}), 400

        # Format profile name (lowercase and underscores)
        formatted_profile_name = profile_name.lower().replace(' ', '_')

        # Check if profile already exists
        if profiles_collection.find_one({'user_profile': formatted_profile_name}):
            return jsonify({'message': 'Profile already exists'}), 400

        # Create profile document with permissions
        profile_data = {
            'user_profile': formatted_profile_name,  # The profile name (e.g., 'traffic_analyst')
            'permissions': {
                # Each permission is a boolean flag that controls access to different features
                'traffic_management': permissions.get('traffic_management', False),
                'data_health': permissions.get('data_health', False),
                'manage_users': permissions.get('manage_users', False),
                'traffic_data': permissions.get('traffic_data', False),
                'live_map': permissions.get('live_map', False),
                'upload_map': permissions.get('upload_map', False),
                'report': permissions.get('report', False)
            }
        }

        try:
            profiles_collection.insert_one(profile_data)
            return jsonify({'message': 'Profile created successfully'}), 201
        except Exception as e:
            print(f"Error creating profile: {e}")
            return jsonify({'message': 'Error creating profile'}), 500

    # DELETE endpoint for users
    @app.route('/api/users/<int:user_id>', methods=['DELETE'])
    def delete_user(user_id):
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        # Get the current user's profile and check manage_users permission
        user = users_collection.find_one({"username": session['username']})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        # Get permissions from user's profile
        profile = profiles_collection.find_one({"user_profile": user["user_profile"]})
        if not profile or not profile.get('permissions', {}).get('manage_users', False):
            return jsonify({'message': 'Insufficient permissions'}), 403

        result = users_collection.delete_one({"id": user_id})

        if result.deleted_count > 0:
            user_permissions_collection.delete_one({"user_id": user_id})
            return jsonify({'message': 'User deleted successfully'}), 200
        else:
            return jsonify({'message': 'User not found'}), 404

    # DELETE endpoint for profiles
    @app.route('/api/profiles/<string:profile_name>', methods=['DELETE'])
    def delete_profile(profile_name):
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        # Get the user's profile and check manage_users permission
        user = users_collection.find_one({"username": session['username']})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        # Get permissions from user's profile
        profile = profiles_collection.find_one({"user_profile": user["user_profile"]})
        if not profile or not profile.get('permissions', {}).get('manage_users', False):
            return jsonify({'message': 'Insufficient permissions'}), 403

        formatted_profile_name = profile_name.lower().replace(' ', '_')
        result = profiles_collection.delete_one({"user_profile": formatted_profile_name})
        if result.deleted_count > 0:
            return jsonify({'message': 'Profile deleted successfully'}), 200
        else:
            return jsonify({'message': 'Profile not found'}), 404
        
        
    @app.route('/api/users/<int:user_id>', methods=['PUT'])
    def update_user(user_id):
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        # Get the user's profile and check manage_users permission
        user = users_collection.find_one({"username": session['username']})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        # Get permissions from user's profile
        profile = profiles_collection.find_one({"user_profile": user["user_profile"]})
        if not profile or not profile.get('permissions', {}).get('manage_users', False):
            return jsonify({'message': 'Insufficient permissions'}), 403

        data = request.json
        user_update = {}
        permissions_update = {}

        # Update user details if provided
        if 'username' in data:
            user_update['username'] = data['username']
        if 'email' in data:
            user_update['email'] = data['email']
        if 'first_name' in data:
            user_update['first_name'] = data['first_name']
        if 'last_name' in data:
            user_update['last_name'] = data['last_name']
        if 'date_of_birth' in data:
            user_update['date_of_birth'] = data['date_of_birth']
        if 'user_profile' in data:
            user_update['user_profile'] = data['user_profile']

        
        # Update permissions if provided
        for permission in ['traffic_management', 'data_health', 'manage_users', 'urban_planning']:
            if permission in data:
                permissions_update[permission] = data[permission]

        # Update the user details in the main collection
        result = users_collection.update_one({"id": user_id}, {"$set": user_update})
        
        # Update permissions if there are changes in the permissions update dictionary
        if permissions_update:
            user_permissions_collection.update_one(
                {"user_id": user_id},
                {"$set": permissions_update}
            )

        if result.matched_count > 0:
            return jsonify({'message': 'User updated successfully'}), 200
        else:
            return jsonify({'message': 'User not found or no changes made'}), 404

    @app.route('/api/profiles/<string:old_profile_name>', methods=['PUT'])
    def update_profile(old_profile_name):
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        # Get the user's profile and check manage_users permission
        user = users_collection.find_one({"username": session['username']})
        if not user:
            return jsonify({'message': 'User not found'}), 404

        # Get permissions from user's profile
        profile = profiles_collection.find_one({"user_profile": user["user_profile"]})
        if not profile or not profile.get('permissions', {}).get('manage_users', False):
            return jsonify({'message': 'Insufficient permissions'}), 403

        data = request.json
        new_profile_name = data.get('user_profile')

        if not new_profile_name:
            return jsonify({'message': 'Invalid profile name'}), 400

        # Check if the new name already exists
        if profiles_collection.find_one({'user_profile': new_profile_name}):
            return jsonify({'message': 'Profile name already exists'}), 400

        # Update the profile name
        result = profiles_collection.update_one(
            {'user_profile': old_profile_name},
            {'$set': {'user_profile': new_profile_name}}
        )

        if result.matched_count > 0:
            return jsonify({'message': 'Profile updated successfully'}), 200
        else:
            return jsonify({'message': 'Profile not found'}), 404
        
    @app.route('/api/search-users', methods=['GET'])
    def search_users():
        query = request.args.get('query', '')
        users = list(users_collection.find({
            "$or": [
                {"username": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"first_name": {"$regex": query, "$options": "i"}},
                {"last_name": {"$regex": query, "$options": "i"}}
            ]
        }, {"_id": 0, "password": 0}))

        # Add profile permissions for each user
        for user in users:
            profile = profiles_collection.find_one(
                {"user_profile": user["user_profile"]},
                {"_id": 0, "permissions": 1}
            )
            if profile:
                user["permissions"] = profile.get("permissions", {})
            else:
                user["permissions"] = {}

        return jsonify(users)
        
    @app.route('/api/search-profiles', methods=['GET'])
    def search_profiles():
        query = request.args.get('query', '')
        profiles = list(profiles_collection.find({
            "user_profile": {"$regex": query, "$options": "i"}
        }, {"_id": 0}))  
        return jsonify(profiles)
        
    def validate_map_xml(xml_content):
        try:
            # Parse XML content
            root = ET.fromstring(xml_content)
            
            # Register the SVG namespace
            ns = {'svg': 'http://www.w3.org/2000/svg'}
            
            # Check basic structure
            if root.tag != 'town':
                return False, "Root element must be 'town'", 0

            map_elem = root.find('map')
            if map_elem is None:
                return False, "Missing 'map' element", 0

            # Check for required attributes
            if 'width' not in map_elem.attrib or 'height' not in map_elem.attrib:
                return False, "Map must have width and height attributes", 0

            # Check for routes section
            routes = map_elem.find('routes')
            if routes is None:
                return False, "Missing 'routes' section", 0

            # Count all routes
            road_count = len(routes.findall('route'))
            
            # Check for SVG element
            svg = map_elem.find('svg:svg', namespaces=ns) or map_elem.find('svg')
            if svg is None:
                return False, "Missing SVG element", 0

            # Validate route elements
            for route in routes.findall('route'):
                if 'id' not in route.attrib or 'type' not in route.attrib:
                    return False, "Each route must have id and type attributes", 0
                if route.find('start') is None or route.find('end') is None:
                    return False, "Each route must have start and end points", 0

            return True, f"Valid map format with {road_count} roads", road_count

        except ET.ParseError as e:
            return False, f"Invalid XML format: {str(e)}", 0
        except Exception as e:
            return False, f"Validation error: {str(e)}", 0

    def get_route_path_mapping(xml_content):
        try:
            root = ET.fromstring(xml_content)
            ns = {'svg': 'http://www.w3.org/2000/svg'}
            
            # Get all routes and their IDs
            routes = root.find('map/routes')
            route_ids = [route.get('id') for route in routes.findall('route')]
            
            # Get all paths from SVG
            svg = root.find('map/svg:svg', namespaces=ns) or root.find('map/svg')
            paths = svg.findall('.//svg:path', namespaces=ns) or svg.findall('.//path')
            
            # Create mapping dictionary
            mapping = {}
            for i, (route_id, path) in enumerate(zip(route_ids, paths)):
                road_id = f'road_{i+1}'
                mapping[road_id] = {
                    'route_id': route_id,
                    'path_id': path.get('id')
                }
            
            return mapping, len(mapping)
        except Exception as e:
            print(f"Error creating route-path mapping: {e}")
            return None, 0

    @app.route('/api/upload', methods=['POST'])
    def upload_file():
        if 'username' not in session:
            return jsonify({'message': 'Unauthorized'}), 403

        if 'file' not in request.files:
            return jsonify({'message': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400
            return jsonify({'message': 'Unauthorized'}), 403

        if 'file' not in request.files:
            return jsonify({'message': 'No file part'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No selected file'}), 400

        if not file.filename.endswith('.xml'):
            return jsonify({'message': 'Only XML files are allowed'}), 400

        try:
            file_content = file.read()
            is_valid, message, _ = validate_map_xml(file_content)
            
            if not is_valid:
                return jsonify({'message': message}), 400

            # Create route-to-path mapping
            mapping, road_count = get_route_path_mapping(file_content)
            if not mapping:
                return jsonify({'message': 'Error processing road mappings'}), 400

            # Store in GridFS with metadata
            filename = secure_filename(file.filename)
            file_id = fs.put(
                file_content,
                filename=filename,
                content_type='text/xml',
                username=session['username'],
                road_count=road_count,
                route_mapping=mapping  # Store the mapping in metadata
            )
            
            return jsonify({
                'message': 'File uploaded successfully',
                'file_id': str(file_id)
            }), 200  # Add success response

        except Exception as e:
            print(f"Error uploading file: {e}")
            return jsonify({'message': f'Error uploading file: {str(e)}'}), 500

    # Modify the get_uploaded_file endpoint to include the mapping
    @app.route('/api/files/<file_id>', methods=['GET'])
    def get_uploaded_file(file_id):
        try:
            file = fs.get(ObjectId(file_id))
            file_data = file.read()
            return jsonify({
                'file_id': file_id,
                'data': file_data.decode('utf-8'),
                'filename': file.filename,
                'route_mapping': file.route_mapping if hasattr(file, 'route_mapping') else {}
            }), 200
        except Exception as e:
            print(f"Error fetching file: {e}")
            return jsonify({'message': 'Error fetching file'}), 500

    @app.route('/api/maps', methods=['GET'])
    def get_maps_list():
        try:
            # Use the files collection directly to get metadata
            files_collection = client['TSUN-TESTING']['maps-upload.files']
            files = files_collection.find()
            
            maps_list = [{
                '_id': str(file['_id']),
                'filename': file['filename'],
                'uploadDate': file['uploadDate'].isoformat(),
                'username': file.get('username', 'unknown')
            } for file in files]
            
            print("Debug: Found maps:", maps_list)  # Debug print
            return jsonify(maps_list)
        except Exception as e:
            print(f"Error fetching maps list: {e}")
            return jsonify({'message': 'Error fetching maps list'}), 500

    # Add this new endpoint for deleting maps
    @app.route('/api/files/<file_id>', methods=['DELETE'])
    def delete_map(file_id):
        try:
            # Check if user is logged in
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized'}), 403

            # Delete file from GridFS
            fs.delete(ObjectId(file_id))
            
            return jsonify({
                'message': 'Map deleted successfully',
                'file_id': file_id
            }), 200
        except Exception as e:
            print(f"Error deleting map: {e}")
            return jsonify({'message': 'Error deleting map'}), 500

    def get_incident_counts(road_id, time_range=None):
        """Get accident and congestion counts for a road"""
        query = {'road_id': road_id}
        
        # Add time range filter if provided
        if time_range:
            query['recorded_at'] = time_range
        
        # Aggregate incidents by type
        pipeline = [
            {'$match': query},
            {'$group': {
                '_id': '$type',
                'count': {'$sum': 1}
            }}
        ]
        
        counts = {
            'ACCIDENT': 0,
            'CONGESTION': 0
        }
        
        results = traffic_incidents.aggregate(pipeline)
        for result in results:
            counts[result['_id']] = result['count']
        
        return counts['ACCIDENT'], counts['CONGESTION']

    @app.route('/api/traffic/data', methods=['GET'])
    def get_traffic_data():
        try:
            search_term = request.args.get('search', '').lower()
            start_date = request.args.get('startDate')
            end_date = request.args.get('endDate')
            start_time = request.args.get('startTime')
            end_time = request.args.get('endTime')
            conditions = request.args.getlist('conditions')  # Add this line

            query = {}

            # Apply search filter if search term exists
            if search_term:
                query['streetName'] = {'$regex': search_term, '$options': 'i'}

            # Handle date filtering
            if start_date or end_date:
                if start_date:
                    # Convert YYYY-MM-DD to DD-MM-YYYY
                    date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                    formatted_start_date = date_obj.strftime('%d-%m-%Y')
                    query['date'] = {'$gte': formatted_start_date}
                if end_date:
                    # Convert YYYY-MM-DD to DD-MM-YYYY
                    date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                    formatted_end_date = date_obj.strftime('%d-%m-%Y')
                    if 'date' in query:
                        query['date']['$lte'] = formatted_end_date
                    else:
                        query['date'] = {'$lte': formatted_end_date}

            # Handle time filtering
            if start_time or end_time:
                if start_time:
                    query['time'] = {'$gte': start_time}
                if end_time:
                    if 'time' in query:
                        query['time']['$lte'] = end_time
                    else:
                        query['time'] = {'$lte': end_time}

            # Add condition filtering
            if conditions:
                query['intensity'] = {'$in': conditions}

            print(f"[DEBUG] Traffic query: {query}")

            # Get current traffic data with filters
            current_data = list(current_traffic_data.find(query, {'_id': 0}))
            print(f"[DEBUG] Found {len(current_data)} records")
            
            # Add incident counts to each record
            for data in current_data:
                accident_count, congestion_count = get_incident_counts(data['road_id'])
                data['accidentCount'] = accident_count
                data['congestionCount'] = congestion_count
            
            return jsonify(current_data)

        except Exception as e:
            print(f"Error fetching traffic data: {e}")
            return jsonify({'message': 'Error fetching traffic data'}), 500

    def build_historical_query(road_id, start_date, end_date, start_time, end_time, conditions):
        query = {'road_id': road_id}

        # Handle date filtering
        if start_date or end_date:
            if start_date:
                date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                formatted_start_date = date_obj.strftime('%d-%m-%Y')
                query['date'] = {'$gte': formatted_start_date}
            if end_date:
                date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                formatted_end_date = date_obj.strftime('%d-%m-%Y')
                if 'date' in query:
                    query['date']['$lte'] = formatted_end_date
                else:
                    query['date'] = {'$lte': formatted_end_date}

        # Handle time filtering
        if start_time or end_time:
            if start_time:
                query['time'] = {'$gte': start_time}
            if end_time:
                if 'time' in query:
                    query['time']['$lte'] = end_time
                else:
                    query['time'] = {'$lte': end_time}

        # Add condition filtering
        if conditions:
            query['intensity'] = {'$in': conditions}

        return query

    @app.route('/api/traffic/history', methods=['GET'])
    def get_historical_traffic():
        try:
            road_id = request.args.get('road_id')
            if not road_id:
                return jsonify({'message': 'Road ID is required'}), 400

            # Build query from request parameters
            query = build_historical_query(
                road_id,
                request.args.get('startDate'),
                request.args.get('endDate'),
                request.args.get('startTime'),
                request.args.get('endTime'),
                request.args.getlist('conditions')
            )

            print(f"[DEBUG] Historical query: {query}")

            # Get historical data for specific road with filters
            historical_data = list(historical_traffic_data.find(query, {'_id': 0}).sort([('timestamp', -1)]))

            print(f"[DEBUG] Found {len(historical_data)} records")

            # Process incidents in batch for better performance
            if historical_data:
                # Get all timestamps
                timestamps = [datetime.strptime(f"{record['date']} {record['time']}", '%d-%m-%Y %H:%M') 
                            for record in historical_data]
                min_time = min(timestamps)
                max_time = max(timestamps)

                # Get all incidents for this road within the entire time range
                all_incidents = list(traffic_incidents.find({
                    'road_id': road_id,
                    'start_time': {
                        '$gte': min_time,
                        '$lte': max_time
                    },
                    'status': 'HISTORICAL'
                }))

                # Create a map of hour-based timestamps to incident counts
                incident_counts = {}
                for incident in all_incidents:
                    hour_key = incident['start_time'].replace(minute=0, second=0, microsecond=0)
                    if hour_key not in incident_counts:
                        incident_counts[hour_key] = {'ACCIDENT': 0, 'CONGESTION': 0}
                    incident_counts[hour_key][incident['type']] += 1

                # Add incident counts to historical records
                for record in historical_data:
                    record_time = datetime.strptime(f"{record['date']} {record['time']}", '%d-%m-%Y %H:%M')
                    hour_key = record_time.replace(minute=0, second=0, microsecond=0)
                    counts = incident_counts.get(hour_key, {'ACCIDENT': 0, 'CONGESTION': 0})
                    record['accidentCount'] = counts['ACCIDENT']
                    record['congestionCount'] = counts['CONGESTION']

            # Calculate total incidents
            total_incidents = traffic_incidents.count_documents({
                'road_id': road_id,
                'status': 'HISTORICAL'
            })
            
            return jsonify({
                'data': historical_data,
                'totalIncidents': total_incidents
            })
            
        except Exception as e:
            print(f"[ERROR] Error fetching historical data: {str(e)}")
            return jsonify({'message': f'Error fetching historical data: {str(e)}'}), 500

    @app.route('/api/traffic/roads', methods=['GET'])
    def get_unique_roads():
        try:
            # Get unique road names from historical data
            unique_roads = historical_traffic_data.distinct('streetName')
            sorted_roads = sorted(unique_roads)
            return jsonify(sorted_roads)
        except Exception as e:
            print(f"Error fetching unique roads: {e}")
            return jsonify({'message': 'Error fetching roads list'}), 500

    # Add new collection for reports
    reports_collection = client['TSUN-TESTING']['reports']

    # Add GridFS instance for reports
    reports_fs = gridfs.GridFS(client['TSUN-TESTING'], collection='reports-files')

    @app.route('/api/reports', methods=['POST'])
    def generate_report():
        try:
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized - Please log in'}), 401

            # Get the username from session
            username = session.get('username', 'unknown_user')

            # Build query for traffic data
            data = request.json
            query = {}

            if data.get('dateRange'):
                date_range = data['dateRange']
                if date_range.get('start'):
                    start_date = datetime.strptime(date_range['start'], '%Y-%m-%d')
                    query['date'] = {'$gte': start_date.strftime('%d-%m-%Y')}
                if date_range.get('end'):
                    end_date = datetime.strptime(date_range['end'], '%Y-%m-%d')
                    if 'date' in query:
                        query['date']['$lte'] = end_date.strftime('%d-%m-%Y')
                    else:
                        query['date'] = {'$lte': end_date.strftime('%d-%m-%Y')}

            if data.get('timeRange'):
                time_range = data['timeRange']
                if time_range.get('start'):
                    query['time'] = {'$gte': time_range['start']}
                if time_range.get('end'):
                    if 'time' in query:
                        query['time']['$lte'] = time_range['end']
                    else:
                        query['time'] = {'$lte': time_range['end']}

            if data.get('selectedRoads'):
                query['streetName'] = {'$in': data['selectedRoads']}

            # Modified query to sort by date and time
            traffic_data = list(historical_traffic_data.find(query, {'_id': 0}).sort([
                ('date', 1),  # 1 for ascending order
                ('time', 1)
            ]))

            # Store report metadata
            report_entry = {
                'reportFormat': 'pdf',  # Always PDF now
                'dataType': data.get('dataType'),
                'dateRange': data.get('dateRange'),
                'timeRange': data.get('timeRange'),
                'selectedRoads': data.get('selectedRoads'),
                'metadata': {
                    'generatedBy': username,
                    'generatedAt': datetime.now(SGT),
                    'reportType': data.get('metadata', {}).get('reportType', 'standard')
                }
            }
            
            # Insert report metadata
            report_id = reports_collection.insert_one(report_entry).inserted_id

            if not traffic_data:
                return jsonify({'message': 'No data found for the selected criteria'}), 404

            # Create DataFrame from traffic data
            df = pd.DataFrame(traffic_data)
            
            # Select columns based on dataType
            if data['dataType'] == 'traffic':
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 'intensity']
            elif data['dataType'] == 'incidents':
                columns = ['streetName', 'date', 'time', 'accidentCount', 'congestionCount', 'incidentCount']
            elif data['dataType'] == 'congestion':
                columns = ['streetName', 'date', 'time', 'intensity', 'congestionCount']
            else:  # comprehensive
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 
                          'intensity', 'accidentCount', 'congestionCount', 'incidentCount']

            df = df[columns]

            # Generate report in requested format
            # Create PDF using ReportLab with modern styling
            buffer = BytesIO()
            doc = SimpleDocTemplate(
                buffer,
                pagesize=landscape(letter),
                leftMargin=50,
                rightMargin=50,
                topMargin=50,
                bottomMargin=50
            )
            elements = []

            # Custom styles
            styles = getSampleStyleSheet()
            styles.add(ParagraphStyle(
                name='CustomTitle',
                parent=styles['Title'],
                fontSize=24,
                spaceAfter=30,
                textColor=colors.HexColor('#2c3e50'),
                alignment=TA_CENTER
            ))
            
            styles.add(ParagraphStyle(
                name='SubTitle',
                parent=styles['Normal'],
                fontSize=12,
                textColor=colors.HexColor('#7f8c8d'),
                alignment=TA_CENTER,
                spaceAfter=20
            ))

            # Header
            title = Paragraph(f"Traffic Report", styles['CustomTitle'])
            subtitle = Paragraph(
                f"Generated on {datetime.now(SGT).strftime('%B %d, %Y at %H:%M')}",
                styles['SubTitle']
            )
            elements.extend([title, subtitle])

            # Add report metadata
            metadata_style = ParagraphStyle(
                name='MetadataStyle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#34495e'),
                spaceAfter=5
            )

            # Report details section
            details = [
                f"Report Type: {data['dataType'].title()}",
                f"Generated By: {username}",
                f"Total Records: {len(traffic_data)}"
            ]
            
            if data.get('dateRange'):
                date_range = data['dateRange']
                if date_range.get('start') and date_range.get('end'):
                    details.append(f"Date Range: {date_range['start']} to {date_range['end']}")
            
            if data.get('timeRange'):
                time_range = data['timeRange']
                if time_range.get('start') and time_range.get('end'):
                    details.append(f"Time Range: {time_range['start']} to {time_range['end']}")

            for detail in details:
                elements.append(Paragraph(detail, metadata_style))

            elements.append(Spacer(1, 20))

            # Table with modern styling
            table_data = [columns] + df.values.tolist()
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                # Header styling
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('TOPPADDING', (0, 0), (-1, 0), 12),
                
                # Content styling
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#2c3e50')),
                ('ALIGN', (0, 1), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 10),
                ('BOTTOMPADDING', (0, 1), (-1, -1), 8),
                ('TOPPADDING', (0, 1), (-1, -1), 8),
                
                # Grid styling
                ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#ecf0f1')),
                ('LINEBELOW', (0, 0), (-1, 0), 2, colors.HexColor('#2980b9')),
                
                # Zebra striping
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8f9fa')])
            ]))
            
            elements.append(table)

            # Footer
            footer_style = ParagraphStyle(
                name='FooterStyle',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#95a5a6'),
                alignment=TA_RIGHT,
                spaceBefore=20
            )
            footer = Paragraph(
                f"Generated by FlowX Traffic Management System<br/>Page 1",
                footer_style
            )
            elements.append(footer)

            # Build PDF
            doc.build(elements)
            buffer.seek(0)
            pdf_data = buffer.getvalue()

            # Store PDF file in GridFS with reference to report metadata
            file_id = reports_fs.put(
                pdf_data,
                filename=f'traffic-report-{report_id}.pdf',
                contentType='application/pdf',
                reportId=report_id
            )

            # Update report metadata with file reference
            reports_collection.update_one(
                {'_id': report_id},
                {'$set': {'fileId': file_id}}
            )

            # Return the PDF to user
            return send_file(
                BytesIO(pdf_data),
                download_name=f'traffic-report-{datetime.now(SGT).strftime("%Y%m%d-%H%M")}.pdf',
                mimetype='application/pdf'
            )

        except Exception as e:
            print(f"Error generating report: {str(e)}")
            error_message = f"Error generating report: {str(e)}"
            if 'username' not in session:
                error_message = "Session expired. Please log in again."
            return jsonify({'message': error_message}), 500

    @app.route('/api/reports/<report_id>/download', methods=['GET'])
    def download_report(report_id):
        try:
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized - Please log in'}), 401

            # Find the report metadata
            report = reports_collection.find_one({'_id': ObjectId(report_id)})
            if not report:
                return jsonify({'message': 'Report not found'}), 404

            # Get the PDF file from GridFS
            if 'fileId' not in report:
                return jsonify({'message': 'Report file not found'}), 404

            grid_out = reports_fs.get(report['fileId'])
            
            return send_file(
                BytesIO(grid_out.read()),
                download_name=f'traffic-report-{report_id}.pdf',
                mimetype='application/pdf'
            )

        except Exception as e:
            print(f"Error downloading report: {str(e)}")
            return jsonify({'message': f'Error downloading report: {str(e)}'}), 500

    @app.route('/api/traffic/available-ranges', methods=['GET'])
    def get_available_ranges():
        try:
            # Get min and max dates
            date_range = historical_traffic_data.aggregate([
                {
                    '$group': {
                        '_id': None,
                        'minDate': {'$min': '$date'},
                        'maxDate': {'$max': '$date'},
                        'minTime': {'$min': '$time'},
                        'maxTime': {'$max': '$time'}
                    }
                }
            ])
            
            range_data = list(date_range)[0]
            
            return jsonify({
                'dateRange': {
                    'start': range_data['minDate'],
                    'end': range_data['maxDate']
                },
                'timeRange': {
                    'start': range_data['minTime'],
                    'end': range_data['maxTime']
                }
            })
            
        except Exception as e:
            print(f"Error fetching available ranges: {e}")
            return jsonify({'message': 'Error fetching available ranges'}), 500

    @app.route('/api/reports/preview', methods=['POST'])
    def preview_report():
        try:
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized - Please log in'}), 401

            data = request.json
            query = {}

            if data.get('dateRange'):
                date_range = data['dateRange']
                if date_range.get('start'):
                    start_date = datetime.strptime(date_range['start'], '%Y-%m-%d')
                    query['date'] = {'$gte': start_date.strftime('%d-%m-%Y')}
                if date_range.get('end'):
                    end_date = datetime.strptime(date_range['end'], '%Y-%m-%d')
                    if 'date' in query:
                        query['date']['$lte'] = end_date.strftime('%d-%m-%Y')
                    else:
                        query['date'] = {'$lte': end_date.strftime('%d-%m-%Y')}

            if data.get('timeRange'):
                time_range = data['timeRange']
                if time_range.get('start'):
                    query['time'] = {'$gte': time_range['start']}
                if time_range.get('end'):
                    if 'time' in query:
                        query['time']['$lte'] = time_range['end']
                    else:
                        query['time'] = {'$lte': time_range['end']}

            if data.get('selectedRoads'):
                query['streetName'] = {'$in': data['selectedRoads']}

            # Modified query to sort by date and time and limit to 10 records
            traffic_data = list(historical_traffic_data.find(query, {'_id': 0})
                .sort([
                    ('date', 1),  # 1 for ascending order
                    ('time', 1)
                ])
                .limit(10))

            if not traffic_data:
                return jsonify({'message': 'No data found for the selected criteria'}), 404

            # Select columns based on dataType
            if data['dataType'] == 'traffic':
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 'intensity']
            elif data['dataType'] == 'incidents':
                columns = ['streetName', 'date', 'time', 'accidentCount', 'congestionCount', 'incidentCount']
            elif data['dataType'] == 'congestion':
                columns = ['streetName', 'date', 'time', 'intensity', 'congestionCount']
            else:  # comprehensive
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 
                          'intensity', 'accidentCount', 'congestionCount', 'incidentCount']

            # Filter the data to only include selected columns
            preview_data = []
            for record in traffic_data:
                preview_record = {col: record.get(col) for col in columns}
                preview_data.append(preview_record)

            return jsonify({
                'columns': columns,
                'data': preview_data
            })

        except Exception as e:
            print(f"Error generating preview: {str(e)}")
            return jsonify({'message': f'Error generating preview: {str(e)}'}), 500

    @app.route('/api/reports/list', methods=['GET'])
    def get_reports_list():
        try:
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized - Please log in'}), 401

            # Get query parameters for filtering
            search_term = request.args.get('search', '').lower()
            report_type = request.args.get('type', 'all')

            # Build the query
            query = {}
            
            # Add search filter if search term exists
            if search_term:
                query['$or'] = [
                    {'dataType': {'$regex': search_term, '$options': 'i'}},
                    {'metadata.generatedBy': {'$regex': search_term, '$options': 'i'}}
                ]

            # Add type filter if specific type is requested
            if report_type != 'all':
                query['dataType'] = report_type

            # Fetch reports with filters and sort by generation date
            reports = list(reports_collection.find(
                query,
                {
                    '_id': 1,
                    'reportFormat': 1,
                    'dataType': 1,
                    'dateRange': 1,
                    'timeRange': 1,
                    'selectedRoads': 1,
                    'metadata': 1
                }
            ).sort('metadata.generatedAt', -1))  # Sort by newest first

            # Convert ObjectId to string for JSON serialization
            for report in reports:
                report['_id'] = str(report['_id'])
                # Format the generated date for display
                if 'metadata' in report and 'generatedAt' in report['metadata']:
                    # Convert ISO string to datetime for formatting
                    generated_at = datetime.fromisoformat(str(report['metadata']['generatedAt']).replace('Z', '+00:00'))
                    report['metadata']['generatedAt'] = generated_at.strftime('%Y-%m-%d %H:%M:%S')

            return jsonify({
                'reports': reports,
                'total': len(reports)
            })

        except Exception as e:
            print(f"Error fetching reports list: {str(e)}")
            return jsonify({'message': f'Error fetching reports: {str(e)}'}), 500

    @app.route('/api/reports/<report_id>', methods=['GET'])
    def get_report_content(report_id):
        try:
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized - Please log in'}), 401

            # Get format parameter from query string
            format_type = request.args.get('format', 'data')

            # Find the report metadata
            report = reports_collection.find_one({'_id': ObjectId(report_id)})
            if not report:
                return jsonify({'message': 'Report not found'}), 404

            # Return PDF file if format=pdf
            if format_type == 'pdf' and 'fileId' in report:
                try:
                    # Get the PDF file from GridFS
                    grid_out = reports_fs.get(report['fileId'])
                    return send_file(
                        BytesIO(grid_out.read()),
                        mimetype='application/pdf'
                    )
                except Exception as e:
                    print(f"Error retrieving PDF: {str(e)}")
                    return jsonify({'message': 'Error retrieving PDF file'}), 500

            # Return data format (existing code)
            # Find the report metadata
            report = reports_collection.find_one({'_id': ObjectId(report_id)})
            if not report:
                return jsonify({'message': 'Report not found'}), 404

            # Build query for historical data based on report filters
            query = {}

            if report.get('dateRange'):
                date_range = report['dateRange']
                if date_range.get('start'):
                    query['date'] = {'$gte': date_range['start']}
                if date_range.get('end'):
                    if 'date' in query:
                        query['date']['$lte'] = date_range['end']
                    else:
                        query['date'] = {'$lte': date_range['end']}

            if report.get('timeRange'):
                time_range = report['timeRange']
                if time_range.get('start'):
                    query['time'] = {'$gte': time_range['start']}
                if time_range.get('end'):
                    if 'time' in query:
                        query['time']['$lte'] = time_range['end']
                    else:
                        query['time'] = {'$lte': time_range['end']}

            if report.get('selectedRoads'):
                query['streetName'] = {'$in': report['selectedRoads']}

            # Get the data
            data = list(historical_traffic_data.find(query, {'_id': 0}).sort([
                ('date', 1),
                ('time', 1)
            ]))

            # Determine columns based on report type
            if report['dataType'] == 'traffic':
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 'intensity']
            elif report['dataType'] == 'incidents':
                columns = ['streetName', 'date', 'time', 'accidentCount', 'congestionCount', 'incidentCount']
            elif report['dataType'] == 'congestion':
                columns = ['streetName', 'date', 'time', 'intensity', 'congestionCount']
            else:  # comprehensive
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 
                          'intensity', 'accidentCount', 'congestionCount', 'incidentCount']

            # Filter data to include only selected columns
            filtered_data = []
            for record in data:
                filtered_record = {col: record.get(col) for col in columns}
                filtered_data.append(filtered_record)

            return jsonify({
                'metadata': {
                    'generatedBy': report['metadata']['generatedBy'],
                    'generatedAt': report['metadata']['generatedAt'].strftime('%Y-%m-%d %H:%M:%S'),
                    'reportType': report['metadata']['reportType']
                },
                'filters': {
                    'dateRange': report.get('dateRange'),
                    'timeRange': report.get('timeRange'),
                    'selectedRoads': report.get('selectedRoads'),
                    'dataType': report['dataType']
                },
                'columns': columns,
                'data': filtered_data
            })

        except Exception as e:
            print(f"Error fetching report content: {str(e)}")
            return jsonify({'message': f"Error fetching report: {str(e)}"}), 500

    @app.route('/api/reports/<report_id>', methods=['DELETE'])
    def delete_report(report_id):
        try:
            if 'username' not in session:
                return jsonify({'message': 'Unauthorized'}), 401

            # Find the report
            report = reports_collection.find_one({'_id': ObjectId(report_id)})
            if not report:
                return jsonify({'message': 'Report not found'}), 404

            # Delete associated PDF file if it exists
            if 'fileId' in report:
                try:
                    reports_fs.delete(report['fileId'])
                except Exception as e:
                    print(f"Error deleting PDF file: {e}")

            # Delete the report metadata
            result = reports_collection.delete_one({'_id': ObjectId(report_id)})
            
            if result.deleted_count > 0:
                return jsonify({'message': 'Report deleted successfully'}), 200
            else:
                return jsonify({'message': 'Report not found'}), 404

        except Exception as e:
            print(f"Error deleting report: {str(e)}")
            return jsonify({'message': f'Error deleting report: {str(e)}'}), 500

    return app