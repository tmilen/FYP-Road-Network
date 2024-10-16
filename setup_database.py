import sqlite3

# Connect to (or create) the SQLite database
conn = sqlite3.connect('roads.db')
cursor = conn.cursor()

# Create the roads table
cursor.execute('''
    CREATE TABLE IF NOT EXISTS roads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        congestion_level INTEGER NOT NULL
    )
''')

# Insert sample data
sample_data = [
    ('Orchard Road', 1.3048, 103.8318, 95),
    ('ECP', 1.2976, 103.8581, 90),
    ('PIE', 1.3409, 103.7488, 85),
    ('KPE', 1.3292, 103.9049, 80),
    ('CTE', 1.3428, 103.8470, 78),
    ('AYE', 1.2765, 103.8020, 76),
    ('BKE', 1.3788, 103.7653, 72),
    ('Nicoll Highway', 1.2986, 103.8636, 70),
    ('Jalan Bukit Merah', 1.2750, 103.8237, 68),
    ('TPE', 1.3914, 103.9067, 65)
]

# Insert data into the table
cursor.executemany('''
    INSERT INTO roads (name, latitude, longitude, congestion_level)
    VALUES (?, ?, ?, ?)
''', sample_data)

# Commit the changes and close the connection
conn.commit()
conn.close()

print("Database setup completed successfully!")
