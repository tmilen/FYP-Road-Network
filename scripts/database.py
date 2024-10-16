import sqlite3

def get_top_congested_roads(limit=10):
    conn = sqlite3.connect('roads.db')
    cursor = conn.cursor()

    query = """
    SELECT name, latitude, longitude, congestion_level
    FROM roads
    ORDER BY congestion_level DESC
    LIMIT ?;
    """
    cursor.execute(query, (limit,))
    roads = cursor.fetchall()

    conn.close()
    return roads
