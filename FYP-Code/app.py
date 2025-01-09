from flask import Flask, request, session, jsonify, make_response
from pymongo import MongoClient
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

    def fetch_current_traffic():
        """Fetch current traffic data for all roads"""
        try:
            bulk_data = []
            current_time = get_sgt_time()
            expected_road_count = len(SINGAPORE_ROADS)
            
            # First, clear existing data
            current_traffic_data.delete_many({})
            print(f"Cleared existing traffic data. Expecting {expected_road_count} new records")
            
            api_success_count = 0
            api_failed_count = 0
            
            for road in SINGAPORE_ROADS:
                try:
                    tomtom_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={road['lat']},{road['lng']}&key={tomtom_api_key}"
                    incidents_url = f"https://api.tomtom.com/traffic/services/5/incidentDetails?key={tomtom_api_key}&bbox={road['lat']-0.01},{road['lng']-0.01},{road['lat']+0.01},{road['lng']+0.01}"
                    
                    print(f"[API DEBUG] Requesting data for {road['name']}")
                    flow_response = requests.get(tomtom_url)
                    incidents_response = requests.get(incidents_url)
                    
                    if flow_response.status_code == 200 and incidents_response.status_code == 200:
                        api_success_count += 1
                        print(f"[API SUCCESS] {road['name']} - Status: {flow_response.status_code}")
                        traffic_info = flow_response.json()
                        incidents_info = incidents_response.json()
                        
                        current_speed = traffic_info['flowSegmentData']['currentSpeed']
                        free_flow_speed = traffic_info['flowSegmentData']['freeFlowSpeed']
                        
                        speed_ratio = current_speed / free_flow_speed
                        if speed_ratio > 0.8:
                            intensity = 'low'
                        elif speed_ratio > 0.5:
                            intensity = 'medium'
                        else:
                            intensity = 'high'
                        
                        # Process incidents
                        incidents = []
                        accident_count = 0
                        congestion_count = 0
                        if 'incidents' in incidents_info:
                            for incident in incidents_info['incidents']:
                                incident_type = incident.get('type', 'Unknown')
                                if incident_type in ['ACCIDENT']:
                                    accident_count += 1
                                elif incident_type in ['CONGESTION']:
                                    congestion_count += 1
                                if incident_type in ['ACCIDENT', 'CONGESTION']:
                                    incidents.append({
                                        'type': incident_type,
                                        'description': incident.get('description', ''),
                                        'severity': incident.get('severity', 0)
                                    })
                        
                        current_time = get_sgt_time()
                        data_point = {
                            'road_id': f"road_{SINGAPORE_ROADS.index(road) + 1}",
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
                            'intensity': intensity,
                            'incidents': incidents,
                            'accidentCount': accident_count,
                            'congestionCount': congestion_count,
                            'incidentCount': len(incidents)  # Total of accidents and congestion only
                        }
                        bulk_data.append(data_point)
                    else:
                        api_failed_count += 1
                        print(f"[API ERROR] {road['name']} - Failed with status: {flow_response.status_code}")

                except Exception as e:
                    api_failed_count += 1
                    print(f"[API ERROR] {road['name']} - Exception: {str(e)}")
                    continue

            print(f"\n[API SUMMARY] Total Roads: {len(SINGAPORE_ROADS)}")
            print(f"[API SUMMARY] Successful Requests: {api_success_count}")
            print(f"[API SUMMARY] Failed Requests: {api_failed_count}")

            if bulk_data:
                # Insert new traffic data
                current_traffic_data.insert_many(bulk_data)
                actual_count = len(bulk_data)
                
                print(f"Updated traffic data: {actual_count}/{expected_road_count} roads")
                
                if actual_count != expected_road_count:
                    print(f"Warning: Missing data for {expected_road_count - actual_count} roads")
                    
                return actual_count == expected_road_count
            
            print("No traffic data was collected")
            return False

        except Exception as e:
            print(f"[CRITICAL ERROR] Error in fetch_current_traffic: {e}")
            return False

    # Add new collection for historical traffic data
    historical_traffic_data = client['TSUN-TESTING']['historical_traffic_data']

    def fetch_historical_traffic():
        """Fetch and store historical traffic data for the past 3 days"""
        try:
            current_time = get_sgt_time()
            expected_total_records = len(SINGAPORE_ROADS) * 24 * 1  # 3 days * 24 hours * number of roads
            
            # Clear existing historical data
            historical_traffic_data.delete_many({})
            print(f"[HISTORICAL] Cleared existing historical data. Expecting {expected_total_records} records")
            
            bulk_data = []
            api_success_count = 0
            api_failed_count = 0
            
            # Generate timestamps for the past 3 days, hourly intervals
            for hours_ago in range(24, 0, -1):  # 72 hours = 3 days
                timestamp = current_time - timedelta(hours=hours_ago)
                print(f"\n[HISTORICAL] Processing data for: {timestamp}")
                
                for road in SINGAPORE_ROADS:
                    try:
                        tomtom_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={road['lat']},{road['lng']}&key={tomtom_api_key}"
                        incidents_url = f"https://api.tomtom.com/traffic/services/5/incidentDetails?key={tomtom_api_key}&bbox={road['lat']-0.01},{road['lng']-0.01},{road['lat']+0.01},{road['lng']+0.01}"
                        
                        flow_response = requests.get(tomtom_url)
                        incidents_response = requests.get(incidents_url)
                        
                        if flow_response.status_code == 200 and incidents_response.status_code == 200:
                            api_success_count += 1
                            traffic_info = flow_response.json()
                            incidents_info = incidents_response.json()
                            
                            current_speed = traffic_info['flowSegmentData']['currentSpeed']
                            free_flow_speed = traffic_info['flowSegmentData']['freeFlowSpeed']
                            
                            speed_ratio = current_speed / free_flow_speed
                            if speed_ratio > 0.8:
                                intensity = 'low'
                            elif speed_ratio > 0.5:
                                intensity = 'medium'
                            else:
                                intensity = 'high'
                            
                            # Process incidents
                            incidents = []
                            accident_count = 0
                            congestion_count = 0
                            if 'incidents' in incidents_info:
                                for incident in incidents_info['incidents']:
                                    incident_type = incident.get('type', 'Unknown')
                                    if incident_type in ['ACCIDENT']:
                                        accident_count += 1
                                    elif incident_type in ['CONGESTION']:
                                        congestion_count += 1
                                    if incident_type in ['ACCIDENT', 'CONGESTION']:
                                        incidents.append({
                                            'type': incident_type,
                                            'description': incident.get('description', ''),
                                            'severity': incident.get('severity', 0)
                                        })
                            
                            data_point = {
                                'road_id': f"road_{SINGAPORE_ROADS.index(road) + 1}",
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
                                'intensity': intensity,
                                'incidents': incidents,
                                'accidentCount': accident_count,
                                'congestionCount': congestion_count,
                                'incidentCount': len(incidents)  # Total of accidents and congestion only
                            }
                            bulk_data.append(data_point)
                        else:
                            api_failed_count += 1
                            print(f"[HISTORICAL ERROR] {road['name']} - Failed with status: {flow_response.status_code}")

                    except Exception as e:
                        api_failed_count += 1
                        print(f"[HISTORICAL ERROR] {road['name']} - Exception: {str(e)}")
                        continue

            if bulk_data:
                # Insert historical traffic data
                historical_traffic_data.insert_many(bulk_data)
                actual_count = len(bulk_data)
                
                print(f"\n[HISTORICAL SUMMARY] Expected Records: {expected_total_records}")
                print(f"[HISTORICAL SUMMARY] Actual Records: {actual_count}")
                print(f"[HISTORICAL SUMMARY] Success Rate: {(actual_count/expected_total_records)*100:.2f}%")
                print(f"[HISTORICAL SUMMARY] API Successes: {api_success_count}")
                print(f"[HISTORICAL SUMMARY] API Failures: {api_failed_count}\n")
                
                return actual_count == expected_total_records
            
            print("[HISTORICAL] No historical data was collected")
            return False

        except Exception as e:
            print(f"[HISTORICAL CRITICAL ERROR] Error in fetch_historical_traffic: {e}")
            return False

     # Initialize the scheduler
    scheduler = BackgroundScheduler(timezone="Asia/Singapore")
    
    # Modify scheduler task for current traffic data to run every 30 minutes on the clock (e.g., 00:00, 00:30, 01:00, 01:30)
    @scheduler.scheduled_job('cron', id='fetch_current_traffic', minute='0,30', misfire_grace_time=300)
    def scheduled_current_traffic_fetch():
        try:
            current_time = get_sgt_time()
            print(f"[SCHEDULER DEBUG] Starting current traffic data fetch at {current_time}")
            fetch_current_traffic()
            print(f"[SCHEDULER DEBUG] Completed traffic fetch at {get_sgt_time()}")
        except Exception as e:
            print(f"[SCHEDULER ERROR] Error in traffic fetch: {e}")

    # Modify scheduler for historical data to run every hour
    @scheduler.scheduled_job('cron', id='fetch_historical_traffic', minute='0', misfire_grace_time=300)
    def scheduled_historical_traffic_fetch():
        try:
            current_time = get_sgt_time()
            print(f"[SCHEDULER DEBUG] Starting hourly historical data fetch at {current_time}")
            fetch_historical_traffic()
            print(f"[SCHEDULER DEBUG] Completed historical fetch at {get_sgt_time()}")
        except Exception as e:
            print(f"[SCHEDULER ERROR] Error in historical fetch: {e}")

    # Add these lines to ensure scheduler is running
    print("[SCHEDULER] Starting scheduler...")
    scheduler.print_jobs()
    scheduler.start()
    print("[SCHEDULER] Scheduler started successfully")

    # Initialize current traffic data if collection is empty
    if current_traffic_data.count_documents({}) == 0:
        print("[INIT] No current traffic data found. Fetching initial data...")
        if fetch_current_traffic():
            print("[INIT] Successfully initialized current traffic data")
        else:
            print("[INIT ERROR] Failed to initialize current traffic data")

    # Initialize historical traffic data if collection is empty
    if historical_traffic_data.count_documents({}) == 0:
        print("[INIT] No historical traffic data found. Fetching initial data...")
        if fetch_historical_traffic():
            print("[INIT] Successfully initialized historical traffic data")
        else:
            print("[INIT ERROR] Failed to initialize historical traffic data")

    # Function to create default profiles if they don't exist
    def create_profiles():
        profiles = ['system_admin', 'traffic_analyst', 'urban_planner', 'data_engineer', 'traffic_management_user']
        existing_profiles = profiles_collection.distinct("user_profile")
        for profile in profiles:
            if profile not in existing_profiles:
                profiles_collection.insert_one({"user_profile": profile})
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
                # Fetch permissions from the user_permissions_collection
                permissions = user_permissions_collection.find_one(
                    {"user_id": user["id"]},
                    {"_id": 0, "user_id": 0}  # Exclude _id and user_id fields
                )
                if not permissions:
                    permissions = {}  # Default to empty permissions if none found

                # Debugging output to verify permissions and session
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



    @app.route('/api/permissions', methods=['POST'])
    def set_user_permissions():
        data = request.json
        user_id = data.get('user_id')
        permissions = {
            "traffic_management": data.get("traffic_management", False),
            "data_health": data.get("data_health", False),
            "manage_users": data.get("manage_users", False),
            "urban_planning": data.get("urban_planning", False),
        }

        # Insert or update the permissions for the user
        user_permissions_collection.update_one(
            {"user_id": user_id},
            {"$set": permissions},
            upsert=True
        )

        return jsonify({'message': 'Permissions updated successfully'}), 201

    @app.route('/api/permissions/<int:user_id>', methods=['GET'])
    def get_user_permissions(user_id):
        permissions = user_permissions_collection.find_one({"user_id": user_id}, {"_id": 0})
        if permissions:
            return jsonify(permissions)
        else:
            return jsonify({"error": "Permissions not found"}), 404


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
        users = list(users_collection.find({
            "$or": [
                {"username": {"$regex": query, "$options": "i"}},
                {"email": {"$regex": query, "$options": "i"}},
                {"first_name": {"$regex": query, "$options": "i"}},
                {"last_name": {"$regex": query, "$options": "i"}}
            ]
        }, {"_id": 0, "password": 0}))  
        return jsonify(users)

    # Add a new user
    @app.route('/api/users', methods=['POST'])
    def add_user():
        if 'username' not in session or session['role'] != 'system_admin':
            return jsonify({'message': 'Unauthorized'}), 403

        data = request.json
        
        # Log the data received to check permissions
        print("Data received:", data)

        username = data.get('username')
        password = data.get('password')
        email = data.get('email')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        date_of_birth = data.get('date_of_birth')
        user_profile = data.get('user_profile', 'traffic_management_user')

        # Check if required fields are empty
        if not all([username, password, email, first_name, last_name]):
            return jsonify({'message': 'All fields are required'}), 400

        # Retrieve permissions from the data
        permissions = data.get('permissions', {
            "traffic_management": False,
            "data_health": False,
            "manage_users": False,
            "urban_planning": False
        })
        
        # Log permissions to verify values
        print("Permissions to be set:", permissions)

        if users_collection.find_one({'username': username}):
            return jsonify({'message': 'Username already exists'}), 400

        if users_collection.find_one({'email': email}):
            return jsonify({'message': 'Email already exists'}), 400

        hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
        new_user_id = get_next_user_id() 

        # Insert new user data
        users_collection.insert_one({
            'id': new_user_id,
            'username': username,
            'password': hashed_password,
            'email': email,
            'first_name': first_name,
            'last_name': last_name,
            'date_of_birth': date_of_birth,
            'user_profile': user_profile
        })

        # Initialize permissions for the new user
        user_permissions_collection.insert_one({
            'user_id': new_user_id,
            'traffic_management': permissions["traffic_management"],
            'data_health': permissions["data_health"],
            'manage_users': permissions["manage_users"],
            'urban_planning': permissions["urban_planning"]
        })

        # Log the permissions inserted into the database
        inserted_permissions = user_permissions_collection.find_one({"user_id": new_user_id}, {"_id": 0})
        print("Permissions inserted into the database:", inserted_permissions)

        return jsonify({'message': 'User created successfully with permissions'}), 201

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
        if 'username' not in session or session['role'] != 'system_admin':
            return jsonify({'message': 'Unauthorized'}), 403

        data = request.json
        profile_name = data.get('user_profile')

        # Check if profile name is empty
        if not profile_name:
            return jsonify({'message': 'Profile name is required'}), 400

        if profiles_collection.find_one({'user_profile': profile_name}):
            return jsonify({'message': 'Profile already exists'}), 400

        profiles_collection.insert_one({'user_profile': profile_name})
        return jsonify({'message': 'Profile created successfully'}), 201

    # DELETE endpoint for users
    @app.route('/api/users/<int:user_id>', methods=['DELETE'])
    def delete_user(user_id):
        if 'username' not in session or session['role'] != 'system_admin':
            return jsonify({'message': 'Unauthorized'}), 403

        result = users_collection.delete_one({"id": user_id})

        if result.deleted_count > 0:
            user_permissions_collection.delete_one({"user_id": user_id})
            return jsonify({'message': 'User deleted successfully'}), 200
        else:
            return jsonify({'message': 'User not found'}), 404


    # DELETE endpoint for profiles
    @app.route('/api/profiles/<string:profile_name>', methods=['DELETE'])
    def delete_profile(profile_name):
        if 'username' not in session or session['role'] != 'system_admin':
            return jsonify({'message': 'Unauthorized'}), 403

        formatted_profile_name = profile_name.lower().replace(' ', '_')
        result = profiles_collection.delete_one({"user_profile": formatted_profile_name})
        if result.deleted_count > 0:
            return jsonify({'message': 'Profile deleted successfully'}), 200
        else:
            return jsonify({'message': 'Profile not found'}), 404
        
        
    @app.route('/api/users/<int:user_id>', methods=['PUT'])
    def update_user(user_id):
        if 'username' not in session or session['role'] != 'system_admin':
            return jsonify({'message': 'Unauthorized'}), 403

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
        if 'username' not in session or session['role'] != 'system_admin':
            return jsonify({'message': 'Unauthorized'}), 403

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

        # Fetch permissions for each user and add to their data
        for user in users:
            permissions = user_permissions_collection.find_one(
                {"user_id": user["id"]},
                {"_id": 0, "user_id": 0}
            )
            user["permissions"] = permissions if permissions else {}

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
                        query['time']['$lte'] = end_time

            # Add condition filtering
            if conditions:
                query['intensity'] = {'$in': conditions}

            print(f"[DEBUG] Traffic query: {query}")

            # Get current traffic data with filters
            current_data = list(current_traffic_data.find(query, {'_id': 0}))
            print(f"[DEBUG] Found {len(current_data)} records")
            
            # Add incident count to each record
            for data in current_data:
                data['totalIncidents'] = historical_traffic_data.count_documents({
                    'road_id': data['road_id'],
                    'intensity': 'high'
                })
            
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
            historical_data = list(historical_traffic_data.find(query, {'_id': 0}).sort([('timestamp', -1)]))  # Fixed sort method

            print(f"[DEBUG] Found {len(historical_data)} records")
            if len(historical_data) == 0:
                sample_data = list(historical_traffic_data.find(
                    {'road_id': road_id},
                    {'date': 1, 'time': 1, '_id': 0}
                ).limit(5))
                print(f"[DEBUG] Sample data in DB: {sample_data}")

            # Calculate total incidents for this road
            total_incidents = historical_traffic_data.count_documents({
                'road_id': road_id,
                'intensity': 'high'
            })
            
            return jsonify({
                'data': historical_data,
                'totalIncidents': total_incidents
            })
            
        except Exception as e:
            print(f"[ERROR] Error fetching historical data: {str(e)}")
            return jsonify({'message': f'Error fetching historical data: {str(e)}'}), 500

    return app


