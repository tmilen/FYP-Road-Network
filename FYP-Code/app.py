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
from datetime import datetime,timezone
import zipfile
import threading
import time
import tensorflow as tf
import shutil
from tensorflow.keras.models import load_model
from tensorflow.keras.callbacks import LambdaCallback
from tensorflow.keras.preprocessing.image import ImageDataGenerator
import osmnx as ox
import networkx as nx
import pickle
import os
from math import sqrt

load_dotenv()
def create_app(db_client=None):
    app = Flask(__name__)
    
    app.config['SESSION_COOKIE_SAMESITE'] = "None"
    app.config['SESSION_COOKIE_SECURE'] = True
    
    # Update CORS configuration to allow credentials
    CORS(app, 
        supports_credentials=True, 
        resources={r"/*": {
            "origins": [os.getenv("FRONTEND_URL"),"http://127.0.0.1:3000", "http://localhost:3000"],
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }})

    client = db_client or MongoClient(os.getenv("MONGODB_URI"))
    app.secret_key = os.getenv('SECRET_KEY', 'fyp_key')
    tomtom_api_key = os.getenv('TOMTOM_API_KEY')

    db = client['traffic-users']
    users_collection = db['users']
    profiles_collection = db['profiles']
    user_permissions_collection = db['user_permissions']

    # Create a GridFS instance for file storage
    fs = gridfs.GridFS(client['traffic-data'], collection='maps-upload')

    # Add collection for historical traffic data
    historical_traffic_data = client['traffic-data']['historical_traffic_data']

    traffic_logs = client['traffic-data']['traffic_logs']

        # Add timezone configuration
    SGT = pytz.timezone('Asia/Singapore')
    
    def get_sgt_time():
        return datetime.now(pytz.utc).astimezone(SGT)

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
    current_traffic_data = client['traffic-data']['current_traffic_data']

    # Add new collection for traffic incidents
    traffic_incidents = client['traffic-data']['traffic_incidents']

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
            bulk_historical = []  # New list for historical data
            current_time = get_sgt_time()
            expected_road_count = len(SINGAPORE_ROADS)
            print(f"Updating traffic data. Expecting {expected_road_count} records")
            
            # Check if current time is at the hour (minutes = 00)
            is_hourly = current_time.minute == 0
            if is_hourly:
                print(f"[DEBUG] Hourly checkpoint detected at {current_time}")
            
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
                        
                        # Log success
                        log_traffic_activity("success", road["name"], current_time, update_data)

                        # If it's hourly, add to historical data
                        if is_hourly:
                            historical_record = {
                                'road_id': road_id,
                                'streetName': road['name'],
                                'coordinates': {
                                    'lat': road['lat'],
                                    'lng': road['lng']
                                },
                                'date': current_time.strftime('%d-%m-%Y'),
                                'time': current_time.strftime('%H:%M'),
                                'timestamp': current_time,
                                'currentSpeed': current_speed,
                                'freeFlowSpeed': free_flow_speed,
                                'intensity': intensity
                            }
                            bulk_historical.append(historical_record)

                    else:
                        api_failed_count += 1
                        print(f"[API ERROR] {road['name']} - Response validation failed")
                        print(f"Flow Response: {flow_response.text}")
                        log_traffic_activity("failure", road["name"], current_time)     

                except Exception as e:
                    api_failed_count += 1
                    print(f"[API ERROR] {road['name']} - Exception: {str(e)}")
                    log_traffic_activity("failure", road["name"], current_time, {"error": str(e)})
                    continue

            # Update current traffic data
            if bulk_updates:
                result = current_traffic_data.bulk_write(bulk_updates)
                print(f"\n[API SUMMARY] Total Roads: {len(SINGAPORE_ROADS)}")
                print(f"[API SUMMARY] Successful Updates: {api_success_count}")
                print(f"[API SUMMARY] Failed Updates: {api_failed_count}")
                print(f"[API SUMMARY] Modified: {result.modified_count}")
                print(f"[API SUMMARY] Upserted: {result.upserted_count}")

            # Insert historical data if it's hourly
            if is_hourly and bulk_historical:
                try:
                    result = historical_traffic_data.insert_many(bulk_historical)
                    print(f"[HISTORICAL] Inserted {len(result.inserted_ids)} records at hourly checkpoint")
                except Exception as e:
                    print(f"[HISTORICAL ERROR] Failed to insert historical data: {e}")
                
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
            duplicate_count = 0
            
            for hours_ago in range(24, 0, -1):
                timestamp = current_time - timedelta(hours=hours_ago)
                print(f"\n[HISTORICAL] Processing data for: {timestamp}")
                
                for road in SINGAPORE_ROADS:
                    try:
                        road_id = f"road_{SINGAPORE_ROADS.index(road) + 1}"  # Generate road_id
                        
                        # Check if the record already exists
                        existing_record = historical_traffic_data.find_one({
                            'road_id': road_id,  # Use road_id instead of road_name
                            'timestamp': timestamp
                        })
                        
                        if existing_record:
                            duplicate_count += 1
                            print(f"[HISTORICAL] Duplicate record found for {road['name']} at {timestamp}")
                            continue
                        
                        tomtom_url = f"https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point={road['lat']},{road['lng']}&key={tomtom_api_key}"
                        flow_response = requests.get(tomtom_url)
                        
                        if flow_response.status_code == 200:
                            api_success_count += 1
                            traffic_info = flow_response.json()
                            
                            current_speed = traffic_info['flowSegmentData'].get('currentSpeed', 0)
                            free_flow_speed = traffic_info['flowSegmentData'].get('freeFlowSpeed', 0)
                            
                            speed_ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 0
                            if speed_ratio > 0.8:
                                intensity = 'low'
                            elif speed_ratio > 0.5:
                                intensity = 'medium'
                            else:
                                intensity = 'high'
                            
                            historical_record = {
                                'road_id': road_id,  # Add road_id
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
                print(f"[HISTORICAL SUMMARY] Duplicates Skipped: {duplicate_count}")
                print(f"[HISTORICAL SUMMARY] Incidents Recorded: {len(bulk_incidents)}")
                print(f"[HISTORICAL SUMMARY] API Successes: {api_success_count}")
                print(f"[HISTORICAL SUMMARY] API Failures: {api_failed_count}\n")

                return True
                
            print("[HISTORICAL] No historical data was collected")
            return False

        except Exception as e:
            print(f"[CRITICAL ERROR] Error in fetch_historical_traffic: {e}")
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

    # Remove the old historical scheduler and replace with this:
    def schedule_one_time_historical_fetch():
        current_time = get_sgt_time()
        run_time = current_time + timedelta(minutes=1)
        
        scheduler.add_job(
            func=scheduled_historical_traffic_fetch,
            trigger='date',
            run_date=run_time,
            id='one_time_historical_fetch',
            name='One-time Historical Data Fetch',
            misfire_grace_time=300
        )
        print(f"[SCHEDULER] Scheduled one-time historical data fetch for: {run_time}")

    def scheduled_historical_traffic_fetch():
        try:
            if check_api_quota():
                print("[SCHEDULER] Skipping historical fetch due to API quota limits")
                return
                
            current_time = get_sgt_time()
            print(f"[SCHEDULER DEBUG] Starting one-time historical data fetch at {current_time}")
            
            # Only fetch historical data if collection is empty
            if historical_traffic_data.count_documents({}) == 0:
                fetch_historical_traffic()
            else:
                print("[HISTORICAL] Historical data already exists, skipping initialization")
                
            print(f"[SCHEDULER DEBUG] Completed historical fetch at {get_sgt_time()}")
        except Exception as e:
            print(f"[SCHEDULER ERROR] Error in historical fetch: {e}")

    # Schedule jobs
    schedule_one_time_historical_fetch()
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
    
    # Start the scheduler
    scheduler.start()
    print("[SCHEDULER] Scheduler started successfully")

    # Remove the immediate initialization check
    # if historical_traffic_data.count_documents({}) == 0:
    #     print("[INIT] No historical traffic data found. Checking API quota before fetching...")
    #     if not check_api_quota():
    #         if fetch_historical_traffic():
    #             print("[INIT] Successfully initialized historical traffic data")
    #         else:
    #             print("[INIT ERROR] Failed to initialize historical traffic data")
    #     else:
    #         print("[INIT ERROR] Cannot initialize data - API quota exceeded")

    # Keep only the current traffic data initialization check if needed
    if current_traffic_data.count_documents({}) == 0:
        print("[INIT] No current traffic data found. Checking API quota before fetching...")
        if not check_api_quota():
            if fetch_current_traffic():
                print("[INIT] Successfully initialized current traffic data")
            else:
                print("[INIT ERROR] Failed to initialize current traffic data")
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
        # Convert query to lowercase and replace spaces with underscores
        formatted_query = query.lower().replace(" ", "_")

        profiles = list(profiles_collection.find({
            "$or": [
                {"user_profile": {"$regex": query, "$options": "i"}},
                {"user_profile": {"$regex": formatted_query, "$options": "i"}}
            ]
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
            files_collection = client['traffic-data']['maps-upload.files']
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
                try:
                    # First, try to parse as YYYY-MM-DD
                    date_obj = datetime.strptime(start_date, '%Y-%m-%d')
                except ValueError:
                    try:
                        # If that fails, try DD-MM-YYYY
                        date_obj = datetime.strptime(start_date, '%d-%m-%Y')
                    except ValueError:
                        print(f"Invalid start date format: {start_date}")
                        return query
                formatted_start_date = date_obj.strftime('%d-%m-%Y')
                query['date'] = {'$gte': formatted_start_date}
                
            if end_date:
                try:
                    # First, try to parse as YYYY-MM-DD
                    date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                except ValueError:
                    try:
                        # If that fails, try DD-MM-YYYY
                        date_obj = datetime.strptime(end_date, '%d-%m-%Y')
                    except ValueError:
                        print(f"Invalid end date format: {end_date}")
                        return query
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

            # Validate time range
            start_time = request.args.get('startTime')
            end_time = request.args.get('endTime')
            if start_time and end_time and end_time < start_time:
                return jsonify({'message': 'End time cannot be earlier than start time'}), 400

            # Build query from request parameters
            query = build_historical_query(
                road_id,
                request.args.get('startDate'),
                request.args.get('endDate'),
                start_time,
                end_time,
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
    reports_collection = client['traffic-data']['reports']

    # Add GridFS instance for reports
    reports_fs = gridfs.GridFS(client['traffic-data'], collection='reports-files')

    def add_incident_data(records, query_date_range=None):
        """Add incident data to traffic records"""
        enhanced_records = []
        
        for record in records:
            # Convert date and time to datetime for comparison
            record_date = datetime.strptime(f"{record['date']} {record['time']}", '%d-%m-%Y %H:%M')
            
            # Build incident query
            incident_query = {
                'road_id': record.get('road_id'),
                'start_time': {
                    '$lte': record_date + timedelta(minutes=30),  # Include incidents within 30 minutes
                    '$gte': record_date - timedelta(minutes=30)
                }
            }
            
            # Add date range if provided
            if query_date_range:
                incident_query['start_time'].update(query_date_range)

            # Count incidents by type
            accident_count = traffic_incidents.count_documents({
                **incident_query,
                'type': 'ACCIDENT'
            })
            
            congestion_count = traffic_incidents.count_documents({
                **incident_query,
                'type': 'CONGESTION'
            })
            
            # Add counts to record
            record['accidentCount'] = accident_count
            record['congestionCount'] = congestion_count
            record['incidentCount'] = accident_count + congestion_count
            
            enhanced_records.append(record)
        
        return enhanced_records

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
            query_date_range = None

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
                        
                # Create date range for incidents query
                if date_range.get('start') and date_range.get('end'):
                    query_date_range = {
                        '$gte': start_date,
                        '$lte': end_date + timedelta(days=1)  # Include full last day
                    }

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

            # Add incident data if needed for incidents, comprehensive, or congestion data types
            if data['dataType'] in ['incidents', 'comprehensive', 'congestion']:
                traffic_data = add_incident_data(traffic_data, query_date_range)

            # Create DataFrame from traffic data
            df = pd.DataFrame(traffic_data)
            
            # Select columns based on dataType
            if data['dataType'] == 'traffic':
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 'intensity']
            elif data['dataType'] == 'incidents':
                columns = ['streetName', 'date', 'time', 'accidentCount', 'congestionCount', 'incidentCount']
            elif data['dataType'] == 'congestion':
                columns = ['streetName', 'date', 'time', 'intensity', 'currentSpeed', 'congestionCount']
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
            date_range = None

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
                        
                # Create date range for incidents query
                query_date_range = None
                if date_range.get('start') and date_range.get('end'):
                    query_date_range = {
                        '$gte': start_date,
                        '$lte': end_date + timedelta(days=1)  # Include full last day
                    }

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

            # Add incident data if needed for incidents, comprehensive, or congestion data types
            if data['dataType'] in ['incidents', 'comprehensive', 'congestion']:
                traffic_data = add_incident_data(traffic_data, query_date_range)

            # Select columns based on dataType
            if data['dataType'] == 'traffic':
                columns = ['streetName', 'date', 'time', 'currentSpeed', 'freeFlowSpeed', 'intensity']
            elif data['dataType'] == 'incidents':
                columns = ['streetName', 'date', 'time', 'accidentCount', 'congestionCount', 'incidentCount']
            elif data['dataType'] == 'congestion':
                columns = ['streetName', 'date', 'time', 'intensity', 'currentSpeed', 'congestionCount']
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
                columns = ['streetName', 'date', 'time', 'intensity', 'currentSpeed', 'congestionCount']
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

    @app.route('/api/traffic/analysis', methods=['GET'])
    def get_traffic_analysis():
        try:
            # Get parameters
            roads = request.args.getlist('roads')
            input_date = request.args.get('date')  # This will be in YYYY-MM-DD format
            start_time = request.args.get('startTime')
            end_time = request.args.get('endTime')
            metric = request.args.get('metric', 'speed')

            if not roads or not input_date:
                return jsonify({'message': 'Roads and date are required'}), 400

            # Convert YYYY-MM-DD to DD-MM-YYYY for database query
            date_obj = datetime.strptime(input_date, '%Y-%m-%d')
            formatted_date = date_obj.strftime('%d-%m-%Y')

            query = {
                'streetName': {'$in': roads},
                'date': formatted_date
            }

            if start_time and end_time:
                query['time'] = {
                    '$gte': start_time,
                    '$lte': end_time
                }

            # Get data sorted by time
            data = list(historical_traffic_data.find(
                query,
                {'_id': 0, 'streetName': 1, 'time': 1, 'currentSpeed': 1, 'intensity': 1, 'road_id': 1}
            ).sort([('time', 1)]))

            # Get incidents if needed
            if metric == 'incidents':
                for record in data:
                    record_time = datetime.strptime(f"{formatted_date} {record['time']}", '%d-%m-%Y %H:%M')
                    incidents = traffic_incidents.count_documents({
                        'road_id': record.get('road_id'),  # Use road_id for more accurate matching
                        'start_time': {
                            '$gte': record_time - timedelta(minutes=30),
                            '$lt': record_time + timedelta(minutes=30)
                        }
                    })
                    record['incidents'] = incidents

            # Organize data by road
            analysis_data = {}
            for road in roads:
                road_data = [d for d in data if d['streetName'] == road]
                analysis_data[road] = {
                    'times': [d['time'] for d in road_data],
                    'values': [
                        d['currentSpeed'] if metric == 'speed'
                        else d.get('incidents', 0) if metric == 'incidents'
                        else 1 if d['intensity'] == 'high' else 0.5 if d['intensity'] == 'medium' else 0
                        for d in road_data
                    ]
                }

            return jsonify({
                'data': analysis_data,
                'metric': metric,
                'date': formatted_date,
                'timeRange': {'start': start_time, 'end': end_time}
            })

        except Exception as e:
            print(f"Error fetching traffic analysis: {str(e)}")
            return jsonify({'message': f'Error fetching analysis: {str(e)}'}), 500

    MODEL_FOLDER = "./Models"
    
    # Global variable to hold training logs
    training_logs = {"trainingComplete": False, "logs": []}
    
    def get_upload_folder():

        if os.getenv("RENDER"):  # If running on Render
            return "/tmp/uploads"  # Use temporary storage in Render
        return "./uploads"  # Use local folder for development

    UPLOAD_FOLDER = get_upload_folder()

    # Ensure the upload directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    print(f"[INFO] Upload folder set to: {UPLOAD_FOLDER}")
    
    #Extracts a zip file to a given directory and ensures no nested directories.
    def extract_zip(zip_file_path, extract_to):
        
        with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
            zip_ref.extractall(extract_to)
            
        print(f"[DEBUG] Extracted files in {extract_to}: {os.listdir(extract_to)}")

        # Get the root folder of the extracted content
        #root_folders = [os.path.join(extract_to, folder) for folder in os.listdir(extract_to)]
        #train_dir_folders = [folder for folder in root_folders if os.path.isdir(folder)]
        '''
        if len(train_dir_folders) == 1:
            nested_folder = train_dir_folders[0]
            for item in os.listdir(nested_folder):
                item_path = os.path.join(nested_folder, item)
                shutil.move(item_path, extract_to)
            shutil.rmtree(nested_folder) ''' # Remove the empty nested folder
        
        
        extracted_items = os.listdir(extract_to)
        nested_folders = [f for f in extracted_items if os.path.isdir(os.path.join(extract_to, f))]

        
        
        if len(nested_folders) == 1:
            nested_folder_path = os.path.join(extract_to, nested_folders[0])
            for item in os.listdir(nested_folder_path):
                shutil.move(os.path.join(nested_folder_path, item), extract_to)
            shutil.rmtree(nested_folder_path)  # Remove empty nested folder

        print(f"[DEBUG] Final extracted structure in {extract_to}: {os.listdir(extract_to)}")

    #Handle ZIP file upload and extraction, ensuring proper directory structure.
    @app.route("/api/upload-zip", methods=["POST"])
    def upload_zip_file():
        
        print("[DEBUG] Upload request received.")

        if "file" not in request.files:
            print("[ERROR] No file found in request.")
            return jsonify({"error": "No file provided."}), 400
        
        file = request.files["file"]

        if file.filename == "":
            print("[ERROR] No selected file.")
            return jsonify({"error": "No file selected."}), 400

        print(f"[DEBUG] File received: {file.filename}")

        # Validate file type
        if not file.filename.lower().endswith(".zip"):
            return jsonify({"error": "Only ZIP files are allowed."}), 400

        # Save the uploaded file
        save_path = os.path.join(UPLOAD_FOLDER, file.filename)
        print(f"[DEBUG] Saving file to: {save_path}")
        file.save(save_path)

        try:
            # Extract the ZIP file
            #extract_to = os.path.join(UPLOAD_FOLDER)
            #os.makedirs(extract_to, exist_ok=True)

            extract_zip(save_path, UPLOAD_FOLDER)

            # Remove the uploaded ZIP file after extraction
            os.remove(save_path)

            return jsonify({"message": "File uploaded and extracted successfully."}), 200

        except Exception as e:
            return jsonify({"error": f"An error occurred: {str(e)}"}), 500
        
    #List all model files in the Models folder.
    @app.route("/api/models", methods=["GET"])
    def list_models():
        
        try:
            if not os.path.exists(MODEL_FOLDER):
                return jsonify({"models": []})  # Return empty if folder doesn't exist

            # Get all model files in the directory
            model_files = [
                f for f in os.listdir(MODEL_FOLDER) 
                if os.path.isfile(os.path.join(MODEL_FOLDER, f))
            ]
            return jsonify({"models": model_files}), 200
        except Exception as e:
            return jsonify({"error": f"Unable to list models: {str(e)}"}), 500

    # Logging function for live logs
    def log_message(message):
        training_logs["logs"].append(message)
        print(message)  # For backend debugging

    #Handles the retraining of the model with the uploaded dataset 
    def run_retraining(model_path):
       
        try:
            log_message("Loading the model...")
            model = load_model(model_path)

            dataset_path = os.path.join(UPLOAD_FOLDER)
            if not os.path.exists(dataset_path):
                log_message("Error: No dataset found in the uploads folder.")
                training_logs["trainingComplete"] = True
                return

            # Data augmentation using ImageDataGenerator
            log_message("Setting up data augmentation...")
            train_datagen = ImageDataGenerator(
                rotation_range=40,
                width_shift_range=0.2,
                height_shift_range=0.2,
                shear_range=0.2,
                zoom_range=0.1,
                brightness_range=[0.5, 1.25],
                horizontal_flip=True,
                vertical_flip=True,
            )

            train_generator = train_datagen.flow_from_directory(
                dataset_path,
                target_size=(300, 300),
                batch_size=256,
                class_mode="categorical",
                seed=55,
            )

            
            log_message("Starting retraining...")
            # Calculate the starting epoch for retraining
            initial_epoch = model.optimizer.iterations.numpy() // len(train_generator)

            history = model.fit(
                train_generator,
                epochs=initial_epoch + 1,  
                initial_epoch=initial_epoch,
                verbose=1,
                callbacks=[
                    LambdaCallback(
                        on_epoch_end=lambda epoch, logs: log_message(
                            f"Epoch {epoch + 1}: Loss = {logs['loss']:.4f}, Accuracy = {logs['accuracy']:.4f}"
                        )
                    )
                ],
            )


            # Save the updated model
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_model_name = f"retrained_model_{timestamp}.keras"
            save_path = os.path.join("./Models", new_model_name)
            model.save(save_path)
            log_message("Model retrained and saved successfully.")
        except Exception as e:
            log_message(f"Error during retraining: {str(e)}")
        finally:
            training_logs["trainingComplete"] = True


    @app.route("/api/retrain", methods=["POST"])
    def retrain_model():
        
        try:
            model_name = request.json.get("model")
            model_path = os.path.join("./Models", model_name)
            
            # Reset the training logs
            training_logs['logs']=[]

            # Run retraining in a separate thread to avoid blocking
            threading.Thread(target=run_retraining, args=(model_path,)).start()

            return jsonify({"message": "Retraining started successfully"}), 200
        except Exception as e:
            return jsonify({"error": f"An unexpected error occurred: {str(e)}"}), 500

    # Flask endpoint to fetch live training logs
    @app.route("/api/logs", methods=["GET"])
    def get_training_logs():
        return jsonify(training_logs), 200
    
    
    @app.route('/api/metrics', methods=['GET'])
    def get_metrics():
        try:
            
            # Total roads processed from the main traffic collection
            total_roads = current_traffic_data.count_documents({})

            # Count of successful API calls 
            successful_calls = traffic_logs.count_documents({"status": "success"})

            # Count of failed API calls
            failed_calls = traffic_logs.count_documents({"status": "failure"})

            # Count of duplicate records
            duplicates = traffic_logs.count_documents({"status": "duplicate"})
            
            # Calculate ingestion latency
            recent_log = traffic_logs.find_one(sort=[("date", -1), ("time", -1)])

            if recent_log and "date" in recent_log and "time" in recent_log:
                log_date = datetime.strptime(recent_log["date"], "%d-%m-%Y")
                log_time = datetime.strptime(recent_log["time"], "%H:%M").time()
                
                # Combine log date and time in SGT (no conversion to UTC)
                log_datetime = datetime.combine(log_date, log_time)
                log_datetime = SGT.localize(log_datetime)  # Mark as Singapore Time

                # Get current time in Singapore Time
                current_datetime = get_sgt_time()

                # Calculate latency in seconds
                latency = (current_datetime - log_datetime).total_seconds()
            else:
                latency = None

            # Prepare metrics
            metrics = {
                "totalRoads": total_roads,
                "successfulCalls": successful_calls,
                "failedCalls": failed_calls,
                "duplicates": duplicates,
                "ingestionLatency": latency,
            }

            return jsonify(metrics), 200

        except Exception as e:
            return jsonify({"error": f"Failed to fetch metrics: {str(e)}"}), 500


    @app.route('/api/live-traffic-logs', methods=['GET'])
    def get_traffic_logs():
        try:

            logs_cursor = traffic_logs.find().sort("timestamp", -1).limit(50)
            logs = []

            for log in logs_cursor:
                logs.append({
                    "timestamp": log["timestamp"].strftime('%Y-%m-%d %H:%M:%S'),
                    "roadName": log.get("roadName", "Unknown"),
                    "status": log["status"],
                    "message": log["message"]
                })

            return jsonify({"logs": logs}), 200

        except Exception as e:
            return jsonify({"error": f"Failed to fetch logs: {str(e)}"}), 500

     
    #Log traffic activity to the traffic_logs collection
    def log_traffic_activity(status, road_name, current_time, additional_info=None):
        
        log_entry = {
            "timestamp": current_time,
            "roadName": road_name,
            "status": status,  # success, failure, duplicate
            "message": f"{status.upper()} for {road_name}",
        }
        if additional_info:
            log_entry.update(additional_info)
        try:
            traffic_logs.insert_one(log_entry)
        except Exception as e:
            print(f"[LOGGING ERROR] Failed to log activity for {road_name}: {str(e)}")
            
            
    @app.route('/api/pie-chart-data', methods=['GET'])
    def get_pie_chart_data():
        try:
            # Count the number of unique vs duplicate records
            total_logs = traffic_logs.count_documents({})
            duplicate_count = traffic_logs.count_documents({"status": "duplicate"})
            unique_count = total_logs - duplicate_count

            return jsonify({
                "labels": ["Unique Entries", "Duplicate Entries"],
                "values": [unique_count, duplicate_count],
            }), 200
        except Exception as e:
            return jsonify({"error": f"Error fetching pie chart data: {str(e)}"}), 500

    @app.route('/api/line-chart-data', methods=['GET'])
    def get_line_chart_data():
        try:  

            # Aggregate API calls by day using 'date' field
            pipeline = [
                {
                    # Add a `date` field if it's missing, extracted from `timestamp`
                    "$addFields": {
                        "date": {
                            "$cond": {
                                "if": { "$not": ["$date"] },  # Check if `date` is missing or null
                                "then": {
                                    "$dateToString": {
                                        "format": "%d-%m-%Y",  # Extract date from `timestamp`
                                        "date": "$timestamp"
                                    }
                                },
                                "else": "$date"  # Use the existing `date` value if present
                            }
                        }
                    }
                },
                {
                    # Filter only documents with a valid `date` field
                    "$match": {
                        "date": { "$exists": True, "$ne": None },
                    }
                },
                {
                    # Group by `date` and calculate aggregates
                    "$group": {
                        "_id": "$date",
                        "successful": {
                            "$sum": { "$cond": [{ "$eq": ["$status", "success"] }, 1, 0] }
                        },
                        "failed": {
                            "$sum": { "$cond": [{ "$eq": ["$status", "failure"] }, 1, 0] }
                        },
                        "duplicates": {
                            "$sum": { "$cond": [{ "$eq": ["$status", "duplicate"] }, 1, 0] }
                        }
                    }
                },
                {
                    # Convert `_id` (date string) to a `date` object for sorting
                    "$addFields": {
                        "parsedDate": {
                            "$dateFromString": {
                                "dateString": "$_id",
                                "format": "%d-%m-%Y"
                            }
                        }
                    }
                },
                {
                    # Sort by the parsed `date` field in ascending order
                    "$sort": { "parsedDate": 1 }
                },
                {
                    # Remove the parsedDate field from output
                    "$unset": "parsedDate"
                }
            ]

            results = list(traffic_logs.aggregate(pipeline))

            labels = [entry["_id"] for entry in results]
            successful = [entry["successful"] for entry in results]
            failed = [entry["failed"] for entry in results]
            duplicates = [entry["duplicates"] for entry in results]

            return jsonify({
                "labels": labels,
                "datasets": [
                    {"label": "Successful Calls", "data": successful},
                    {"label": "Failed Calls", "data": failed},
                    {"label": "Duplicate Calls", "data": duplicates},
                ]
            }), 200

        except Exception as e:
            return jsonify({"error": f"Error fetching line chart data: {str(e)}"}), 500


    @app.route('/api/route', methods=['POST'])
    def calculate_route():
        try:
            data = request.json
            origin = data.get('origin')
            destination = data.get('destination')

            # Debug coordinate values
            print("Received coordinates:", {
                "origin": origin,
                "destination": destination
            })

            # Validate input data
            if not origin or not destination:
                return jsonify({'error': 'Origin and destination are required'}), 400

            try:
                # Convert coordinates to float
                origin = [float(x) for x in origin]
                destination = [float(x) for x in destination]
            except (ValueError, TypeError):
                return jsonify({'error': 'Invalid coordinate values'}), 400

            # Validate coordinate ranges for Singapore
            if not (1.1 <= origin[0] <= 1.5 and 103.6 <= origin[1] <= 104.1 and
                    1.1 <= destination[0] <= 1.5 and 103.6 <= destination[1] <= 104.1):
                return jsonify({'error': 'Coordinates outside Singapore bounds'}), 400

            # Initialize routing if not already done
            if not hasattr(app, 'routing_graph'):
                print("Initializing routing graph...")
                app.routing_graph = initialize_routing_graph()

            # Calculate route
            route_result = calculate_route_with_alternatives(
                app.routing_graph,
                origin,
                destination,
                k=3
            )

            if not route_result:
                return jsonify({'error': 'No route found'}), 404

            print("Route calculated successfully")
            return jsonify(route_result)

        except Exception as e:
            print(f"Error calculating route: {str(e)}")
            return jsonify({'error': str(e)}), 500

    def initialize_routing_graph():
        """Initialize the routing graph using OSMnx"""
        cache_file = './singapore_graph.pkl'
        
        if os.path.exists(cache_file):
            with open(cache_file, 'rb') as f:
                G_multi = pickle.load(f)
        else:
            city = "Singapore"
            G_multi = ox.graph_from_place(city, network_type="drive")
            with open(cache_file, 'wb') as f:
                pickle.dump(G_multi, f)
        
        # Convert MultiDiGraph to DiGraph
        G = nx.DiGraph(G_multi)
        
        # Combine parallel edges by taking the minimum weight
        for u, v, data in G.edges(data=True):
            if 'length' not in data:
                data['length'] = 1000  # Default length if missing
        
        return G

    def get_road_congestion(current_speed, free_flow_speed):
        """Calculate congestion factor based on current speed vs free flow speed"""
        if free_flow_speed == 0:
            return 1.0
        ratio = current_speed / free_flow_speed
        if ratio >= 0.8:
            return 1.0  # Low congestion
        elif ratio >= 0.5:
            return 2.0  # Medium congestion
        else:
            return 3.0  # High congestion
        
    def update_edge_weights(G):
        """Update graph edge weights based on current traffic conditions"""
        try:
            # Get current traffic data
            traffic_data = list(current_traffic_data.find({}, {'_id': 0}))
            
            # Create a mapping of coordinates to traffic data
            traffic_map = {}
            for data in traffic_data:
                coords = (data['coordinates']['lat'], data['coordinates']['lng'])
                traffic_map[coords] = data

            # Update edge weights in the graph
            for u, v, data in G.edges(data=True):
                edge_lat = (G.nodes[u]['y'] + G.nodes[v]['y']) / 2
                edge_lng = (G.nodes[u]['x'] + G.nodes[v]['x']) / 2

                # Find nearest traffic data point
                nearest_traffic = None
                min_distance = float('inf')
                for coords, traffic in traffic_map.items():
                    dist = ((edge_lat - coords[0])**2 + (edge_lng - coords[1])**2)**0.5
                    if dist < min_distance:
                        min_distance = dist
                        nearest_traffic = traffic

                if nearest_traffic and min_distance < 0.01:  # Within ~1km
                    congestion_factor = get_road_congestion(
                        nearest_traffic.get('currentSpeed', 0),
                        nearest_traffic.get('freeFlowSpeed', 0)
                    )
                else:
                    congestion_factor = 1.0

                # Update edge weight combining distance and congestion
                base_length = data.get('length', 1000)
                data['weight'] = base_length * congestion_factor

        except Exception as e:
            print(f"Error updating edge weights: {e}")

    def calculate_route_with_alternatives(G, origin, destination, k=3):
        """Calculate route with alternatives using networkx, considering both distance and congestion"""
        try:
            # Validate input coordinates
            if not all(isinstance(x, (int, float)) for x in origin + destination):
                print("Invalid coordinates:", origin, destination)
                return None

            # Convert coordinates to float explicitly
            try:
                origin_lat, origin_lng = float(origin[0]), float(origin[1])
                dest_lat, dest_lng = float(destination[0]), float(destination[1])
            except (ValueError, TypeError) as e:
                print(f"Error converting coordinates: {e}")
                return None

            # Validate coordinate ranges for Singapore
            if not (1.1 <= origin_lat <= 1.5 and 103.6 <= origin_lng <= 104.1 and
                    1.1 <= dest_lat <= 1.5 and 103.6 <= dest_lng <= 104.1):
                print("Coordinates outside Singapore bounds")
                return None

            print(f"Finding route from ({origin_lat}, {origin_lng}) to ({dest_lat}, {dest_lng})")

            # Get nearest nodes
            origin_node = ox.nearest_nodes(G, origin_lng, origin_lat)
            dest_node = ox.nearest_nodes(G, dest_lng, dest_lat)

            # Calculate straight-line distance between points
            distance = ((origin_lat - dest_lat)**2 + (origin_lng - dest_lng)**2)**0.5
            
            # Handle very close points
            if distance < 0.0005:
                return {
                    'coordinates': [[origin_lat, origin_lng], [dest_lat, dest_lng]],
                    'distance': distance * 111000,
                    'time': (distance * 111000) / 35,
                    'alternatives': [],
                    'warning': 'Points are very close together'
                }

            # Update edge weights based on current traffic
            update_edge_weights(G)

            # Find k shortest paths considering both distance and congestion
            routes = []
            try:
                print("\n=== Route Calculations ===")
                route_counter = 1
                
                for path in nx.shortest_simple_paths(G, origin_node, dest_node, weight='weight'):
                    if len(routes) >= k:
                        break

                    coordinates = []
                    path_length = 0  # in meters
                    total_time = 0   # in minutes
                    congestion_level = 0
                    total_weight = 0
                    
                    print(f"\nRoute {route_counter}:")
                    print("-" * 50)
                    
                    for u, v in zip(path[:-1], path[1:]):
                        lat = float(G.nodes[u]['y'])
                        lng = float(G.nodes[u]['x'])
                        coordinates.append([lat, lng])
                        
                        edge_data = G.get_edge_data(u, v)
                        base_length = float(edge_data.get('length', 1000))  # in meters
                        weight = float(edge_data.get('weight', base_length))
                        
                        # Print segment details
                        print(f"Segment {u}->{v}:")
                        print(f"  Base Length: {base_length:.2f}m")
                        print(f"  Weight: {weight:.2f}")
                        print(f"  Congestion Factor: {(weight/base_length):.2f}")
                        
                        path_length += base_length
                        total_weight += weight
                        congestion_factor = weight / base_length
                        congestion_level = max(congestion_level, congestion_factor)
                        
                        # Calculate segment time:
                        # base_length is in meters
                        # Convert to km and calculate time in minutes
                        # Assume base speed of 35 km/h adjusted by congestion
                        speed_kmh = 35 * (1 / congestion_factor)  # speed in km/h
                        segment_time = (base_length / 1000) / speed_kmh * 60  # Convert to minutes
                        
                        total_time += segment_time
                        print(f"  Estimated Time: {segment_time:.2f} minutes")

                    # Add final node
                    coordinates.append([float(G.nodes[path[-1]]['y']), float(G.nodes[path[-1]]['x'])])
                    
                    # Print route summary
                    print("\nRoute Summary:")
                    print(f"Total Distance: {path_length/1000:.2f}km")
                    print(f"Total Weight: {total_weight:.2f}")
                    print(f"Average Congestion: {congestion_level:.2f}")
                    print(f"Estimated Time: {total_time:.2f} minutes")
                    print("-" * 50)
                    
                    routes.append({
                        'coordinates': coordinates,
                        'distance': path_length,
                        'time': total_time,
                        'congestion': (congestion_level - 1) / 2,
                        'total_weight': total_weight
                    })
                    
                    route_counter += 1

                if not routes:
                    print("No routes found")
                    return None

                print(f"\nFound {len(routes)} alternative routes")
                return {
                    'coordinates': routes[0]['coordinates'],
                    'distance': routes[0]['distance'],
                    'time': routes[0]['time'],
                    'congestion': routes[0]['congestion'],
                    'total_weight': routes[0]['total_weight'],
                    'alternatives': routes[1:]
                }

            except nx.NetworkXNoPath:
                print("No path exists between the given points")
                return None

        except Exception as e:
            print(f"Error in route calculation: {str(e)}")
            return None

    @app.route('/api/storage-metrics', methods=['GET'])
    def get_storage_metrics():
        try:
            print("\n=== Traffic Data Storage Debug ===")
            
            # Get cluster stats
            cluster_stats = client.admin.command('listDatabases')
            print(f"Raw cluster stats: {cluster_stats}")
            
            # Get max size from cluster info
            # If maxSize is not set, fall back to 512MB (Free Tier default)
            TOTAL_SIZE = cluster_stats.get('maxSize', 512 * 1024 * 1024)
            
            # Get stats for traffic-data database only
            db = client['traffic-data']
            db_stats = db.command('dbStats')
            print(f"Raw dbStats for traffic-data: {db_stats}")
            
            # Calculate total size for database
            total_size = db_stats['dataSize'] + db_stats['indexSize']
            
            # Get collections stats
            collections = []
            for collection_name in db.list_collection_names():
                try:
                    coll_stats = db.command('collStats', collection_name)
                    collections.append({
                        'name': collection_name,
                        'size': coll_stats['size'] + coll_stats.get('totalIndexSize', 0),
                        'documentCount': coll_stats['count']
                    })
                except Exception as e:
                    print(f"Error getting stats for collection {collection_name}: {e}")
                    continue
            
            database_stats = [{
                'name': 'traffic-data',
                'size': total_size,
                'collections': collections
            }]
            
            print(f"\n=== Final Calculations ===")
            print(f"Cluster Max Size: {TOTAL_SIZE/1024/1024:.2f} MB")
            print(f"Total Database Size: {total_size/1024/1024:.2f} MB")
            print(f"Usage Percentage: {(total_size/TOTAL_SIZE)*100:.2f}%")
            print(f"Collections count: {len(collections)}")
            
            return jsonify({
                'totalSize': TOTAL_SIZE,
                'usedSize': total_size,
                'databases': database_stats,
                'debug': {
                    'totalSizeMB': total_size/1024/1024,
                    'maxSizeMB': TOTAL_SIZE/1024/1024,
                    'databaseCount': 1,
                    'clusterName': cluster_stats.get('clustername', 'FlowX-Application')
                }
            })

        except Exception as e:
            print(f"Error fetching storage metrics: {str(e)}")
            # Fall back to Free Tier limit if there's an error
            TOTAL_SIZE = 512 * 1024 * 1024
            return jsonify({
                'totalSize': TOTAL_SIZE,
                'usedSize': 0,
                'databases': [],
                'error': str(e),
                'debug': {
                    'maxSizeMB': TOTAL_SIZE/1024/1024,
                    'error': 'Failed to fetch cluster stats, using default Free Tier limit'
                }
            }), 500

    @app.route('/api/collection-data', methods=['GET'])
    def get_collection_data():
        try:
            collection_name = request.args.get('name')
            page = int(request.args.get('page', 1))
            per_page = int(request.args.get('per_page', 10))
            
            if not collection_name:
                return jsonify({'message': 'Collection name is required'}), 400

            db = client['traffic-data']
            collection = db[collection_name]
            
            # Get total count
            total_documents = collection.count_documents({})
            total_pages = (total_documents + per_page - 1) // per_page
            
            # Get paginated documents
            documents = list(collection.find()
                            .skip((page - 1) * per_page)
                            .limit(per_page))
            
            # Convert MongoDB objects to JSON-serializable format
            serialized_documents = []
            for doc in documents:
                serialized_doc = {}
                for key, value in doc.items():
                    if isinstance(value, ObjectId):
                        serialized_doc[key] = str(value)
                    elif isinstance(value, datetime):
                        serialized_doc[key] = value.isoformat()
                    elif isinstance(value, (int, float, str, bool, dict, list)) or value is None:
                        serialized_doc[key] = value
                    else:
                        serialized_doc[key] = str(value)  # Convert any other types to string
                serialized_documents.append(serialized_doc)

            return jsonify({
                'documents': serialized_documents,
                'total': total_documents,
                'page': page,
                'per_page': per_page,
                'total_pages': total_pages
            })

        except Exception as e:
            print(f"Error fetching collection data: {str(e)}")
            return jsonify({'message': f'Error fetching collection data: {str(e)}'}), 500

    @app.route('/api/collection-data/<collection_name>/<document_id>', methods=['DELETE'])
    def delete_document(collection_name, document_id):
        try:
            db = client['traffic-data']
            collection = db[collection_name]
            
            result = collection.delete_one({'_id': ObjectId(document_id)})
            
            if result.deleted_count > 0:
                return jsonify({'message': 'Document deleted successfully'}), 200
            else:
                return jsonify({'message': 'Document not found'}), 404

        except Exception as e:
            print(f"Error deleting document: {str(e)}")
            return jsonify({'message': f'Error deleting document: {str(e)}'}), 500

    return app
