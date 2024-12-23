from flask import Flask, request, session, jsonify, make_response
from pymongo import MongoClient
from flask_cors import CORS
import bcrypt
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()
def create_app(db_client=None):
    app = Flask(__name__)
    CORS(app, supports_credentials=True, resources={r"/*": {"origins": "http://127.0.0.1:3000"}})
    client = db_client or MongoClient(os.getenv("MONGODB_URI"))
    app.secret_key = os.getenv('SECRET_KEY', 'fyp_key')

    db = client['traffic-users']
    users_collection = db['users']
    profiles_collection = db['profiles']
    user_permissions_collection = db['user_permissions']

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
        
    return app


