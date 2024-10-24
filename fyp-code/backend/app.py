from flask import Flask, request, session, jsonify
import sqlite3
from flask_cors import CORS

app = Flask(__name__)
CORS(app, supports_credentials=True)
app.secret_key = 'fyp_key'

# Function to create the database if it doesn't exist
def create_db():
    conn = sqlite3.connect('database.db')
    c = conn.cursor()
    
    # Create Profiles table
    c.execute('''
        CREATE TABLE IF NOT EXISTS Profiles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_profile TEXT NOT NULL UNIQUE
        )
    ''')
    
    # List of profile types
    profiles = ['system_admin', 'traffic_analyst', 'urban_planner', 'data_engineer', 'traffic_management_user']
    
    # Check existing profiles
    c.execute("SELECT user_profile FROM Profiles")
    existing_profiles = [row[0] for row in c.fetchall()]
    
    # Insert profiles that don't already exist
    for profile in profiles:
        if profile not in existing_profiles:
            c.execute("INSERT INTO Profiles (user_profile) VALUES (?)", (profile,))
    
    # Create Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            email TEXT NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            date_of_birth TEXT NOT NULL,
            user_profile INTEGER,
            FOREIGN KEY(user_profile) REFERENCES Profiles(id)
        )
    ''')
    
    conn.commit()
    conn.close()

create_db()


# Function to check user credentials
def check_credentials(username, password):
    conn = sqlite3.connect('database.db')
    c = conn.cursor()

    # Check if the user is in the Users table and get their profile type
    c.execute('''
        SELECT Users.*, Profiles.user_profile 
        FROM Users 
        INNER JOIN Profiles ON Users.user_profile = Profiles.id 
        WHERE username = ? AND password = ?
    ''', (username, password))
    user = c.fetchone()

    conn.close()

    return user

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    user = check_credentials(username, password)

    if user:
        session['username'] = username
        session['role'] = user[8]
        print(f"Session: username = {session.get('username')}, role = {session.get('role')}")
        return jsonify({'status': 'success', 'username': username, 'role': user[8]})
    else:
        return jsonify({'status': 'error', 'message': 'Incorrect username/password'})


@app.route('/logout')
def logout():
    session.pop('username', None)
    session.pop('role', None)
    return jsonify({'status': 'logged out'})


@app.route('/session', methods=['GET'])
def get_session():
    print(f"Session data: {session}")
    if 'username' in session and 'role' in session:
        return jsonify({
            'username': session['username'],
            'role': session['role']
        })
    else:
        return jsonify({'message': 'No active session'}), 404


if __name__ == '__main__':
    app.run(debug=True)
