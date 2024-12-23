from flask import Flask, render_template, request, jsonify, abort
from werkzeug.urls import quote as url_quote
from pymongo import MongoClient
from bson import json_util, ObjectId
import xml.etree.ElementTree as ET
import json
import os
import math
from collections import defaultdict
import heapq
import time



app = Flask(__name__)

# MongoDB setup
def init_database():
    try:
        client = MongoClient('mongodb+srv://Ben:ben7908131@flowx-application.pcug0.mongodb.net/')
        db = client['traffic-management']
        
        # Clear existing collections if they exist
        if 'nodes' in db.list_collection_names():
            db.drop_collection('nodes')
        if 'links' in db.list_collection_names():
            db.drop_collection('links')
        if 'maps' in db.list_collection_names():
            db.drop_collection('maps')
        
        # Create new collections
        db.create_collection('nodes')
        db.create_collection('links')
        db.create_collection('maps')
        
        db.nodes.create_index('id', unique=True)
        print("Database initialization completed successfully")
        
        return db
        
    except Exception as e:
        print(f"Error initializing database: {e}")
        raise e

db = init_database()
nodes_collection = db['nodes']
links_collection = db['links']
maps_collection = db['maps']

class Node:
    def __init__(self, id, name, x, y, lat=None, lon=None):
        self.id = str(id)
        self.name = name
        self.x = float(x)
        self.y = float(y)
        self.lat = float(lat) if lat else None
        self.lon = float(lon) if lon else None

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'x': self.x,
            'y': self.y,
            'lat': self.lat,
            'lon': self.lon
        }

class PathFinder:
    def __init__(self, nodes_collection, links_collection):
        self.nodes = nodes_collection
        self.links = links_collection
        self.roads = {
            'horizontal': {'y': 400},
            'verticals': [150, 500, 850]
        }
        
    def is_direct_path_possible(self, start_pos, end_pos, tolerance=5):
        """Check if a direct path is possible between two points"""
        x1, y1 = float(start_pos['x']), float(start_pos['y'])
        x2, y2 = float(end_pos['x']), float(end_pos['y'])
        
        # Check if both points are on the horizontal road
        if (abs(y1 - self.roads['horizontal']['y']) <= tolerance and 
            abs(y2 - self.roads['horizontal']['y']) <= tolerance):
            return True, 'horizontal'
            
        # Check if both points are on the same vertical road
        for vx in self.roads['verticals']:
            if (abs(x1 - vx) <= tolerance and abs(x2 - vx) <= tolerance):
                return True, 'vertical'
                
        return False, None
        
    def get_nearest_road_point(self, x, y, tolerance=5):
        """Get nearest point on road network"""
        # Check if point is already on a road
        if abs(y - self.roads['horizontal']['y']) <= tolerance:
            return {'x': x, 'y': self.roads['horizontal']['y']}
            
        for vx in self.roads['verticals']:
            if abs(x - vx) <= tolerance:
                return {'x': vx, 'y': y}
        
        # Find nearest road point
        nearest_vertical = min(self.roads['verticals'], key=lambda v: abs(v - x))
        
        # If closer to horizontal road
        if abs(y - self.roads['horizontal']['y']) < abs(x - nearest_vertical):
            return {'x': x, 'y': self.roads['horizontal']['y']}
        else:
            return {'x': nearest_vertical, 'y': y}
    
    def get_valid_moves(self, current_pos):
        """Get all valid moves from current position"""
        moves = []
        x, y = float(current_pos['x']), float(current_pos['y'])
        
        # If on horizontal road
        if abs(y - self.roads['horizontal']['y']) < 5:
            # Can move horizontally to vertical intersections
            moves.extend([
                {'x': vx, 'y': self.roads['horizontal']['y']}
                for vx in self.roads['verticals']
            ])
            
        # If on vertical road
        for vx in self.roads['verticals']:
            if abs(x - vx) < 5:
                # Can move to horizontal intersection
                moves.append({'x': vx, 'y': self.roads['horizontal']['y']})
                # Can move vertically within bounds
                if y > self.roads['horizontal']['y']:
                    moves.append({'x': vx, 'y': 750})  # Bottom
                else:
                    moves.append({'x': vx, 'y': 50})   # Top
        
        return moves
    
    def calculate_distance(self, pos1, pos2):
        """Calculate Manhattan distance between two points"""
        return (abs(float(pos2['x']) - float(pos1['x'])) + 
                abs(float(pos2['y']) - float(pos1['y']))) / 100  # Convert to kilometers
    
    def dijkstra(self, start_node, end_node):
        """Find shortest path between nodes using Dijkstra's algorithm"""
        from heapq import heappush, heappop
        
        start_pos = {'x': float(start_node['x']), 'y': float(start_node['y'])}
        end_pos = {'x': float(end_node['x']), 'y': float(end_node['y'])}
        
        # First check if direct path is possible
        direct_possible, road_type = self.is_direct_path_possible(start_pos, end_pos)
        if direct_possible:
            if road_type == 'horizontal':
                path = [
                    {'x': start_pos['x'], 'y': self.roads['horizontal']['y']},
                    {'x': end_pos['x'], 'y': self.roads['horizontal']['y']}
                ]
            else:  # vertical
                vertical_x = next(vx for vx in self.roads['verticals'] 
                                if abs(float(start_pos['x']) - vx) <= 5)
                path = [
                    {'x': vertical_x, 'y': start_pos['y']},
                    {'x': vertical_x, 'y': end_pos['y']}
                ]
            return path, self.calculate_distance(path[0], path[1])
        
        # Get nearest road points if nodes aren't on roads
        start_road = self.get_nearest_road_point(start_pos['x'], start_pos['y'])
        end_road = self.get_nearest_road_point(end_pos['x'], end_pos['y'])
        
        # Initialize Dijkstra's algorithm
        distances = {str(start_road): 0}
        previous = {str(start_road): None}
        pq = [(0, str(start_road))]
        visited = set()
        
        while pq:
            current_distance, current_pos_str = heappop(pq)
            current_pos = eval(current_pos_str)
            
            if current_pos_str in visited:
                continue
                
            visited.add(current_pos_str)
            
            # Check if we've reached the end
            if (abs(current_pos['x'] - end_road['x']) < 5 and 
                abs(current_pos['y'] - end_road['y']) < 5):
                break
            
            # Try all valid moves
            for next_pos in self.get_valid_moves(current_pos):
                next_pos_str = str(next_pos)
                if next_pos_str in visited:
                    continue
                
                # Calculate new distance
                move_distance = self.calculate_distance(current_pos, next_pos)
                distance = current_distance + move_distance
                
                # Update if shorter path found
                if next_pos_str not in distances or distance < distances[next_pos_str]:
                    distances[next_pos_str] = distance
                    previous[next_pos_str] = current_pos_str
                    heappush(pq, (distance, next_pos_str))
        
        # Reconstruct path
        path = []
        current = str(end_road)
        
        while current is not None:
            path.append(eval(current))
            current = previous.get(current)
            
        path.reverse()
        
        # Add start and end points if they weren't on roads
        if (abs(start_pos['x'] - path[0]['x']) > 5 or 
            abs(start_pos['y'] - path[0]['y']) > 5):
            path.insert(0, start_pos)
            
        if (abs(end_pos['x'] - path[-1]['x']) > 5 or 
            abs(end_pos['y'] - path[-1]['y']) > 5):
            path.append(end_pos)
        
        # Calculate total distance
        total_distance = 0
        for i in range(len(path) - 1):
            total_distance += self.calculate_distance(path[i], path[i + 1])
        
        return path, total_distance

    def get_neighbors(self, node_id):
        """Get all connected nodes for a given node"""
        links = list(self.links.find({
            '$or': [
                {'node1': node_id},
                {'node2': node_id}
            ]
        }))
        
        neighbors = []
        for link in links:
            neighbor_id = link['node2'] if link['node1'] == node_id else link['node1']
            distance = link['distance']
            neighbors.append((neighbor_id, distance))
                
        return neighbors
        
    def validate_path(self, path):
        """Validate that a path is possible by checking consecutive points are on roads"""
        if not path or len(path) < 2:
            return True
            
        for i in range(len(path) - 1):
            pos1, pos2 = path[i], path[i + 1]
            direct_possible, _ = self.is_direct_path_possible(pos1, pos2)
            if not direct_possible:
                return False
                
        return True

class TrafficSimulator:
    def __init__(self, nodes_collection, links_collection):
        self.nodes = nodes_collection
        self.links = links_collection
        self.path_finder = PathFinder(nodes_collection, links_collection)
    
    def simulate_traffic(self, vehicles, start_node, end_node, speed):
        """Simulate traffic flow using road network routing"""
        # Find shortest path using Dijkstra's algorithm
        path, total_distance = self.path_finder.dijkstra(start_node, end_node)
        
        if not path:
            raise ValueError("No valid path found between nodes")
        
        # Calculate basic metrics
        time_per_vehicle = total_distance / speed  # hours
        vehicles_per_hour = vehicles / time_per_vehicle
        
        # Calculate congestion at each point
        congestion = {}
        node_details = {}
        
        for i, point in enumerate(path):
            # Find or create node at this point
            node = self.nodes.find_one({
                'x': {'$gte': point['x'] - 5, '$lte': point['x'] + 5},
                'y': {'$gte': point['y'] - 5, '$lte': point['y'] + 5}
            })
            
            if node:
                node_id = node['id']
                connecting_roads = len(self.get_connecting_roads(node_id))
                
                # Calculate congestion factor
                position_factor = 1 + abs(i - len(path)/2) / len(path)
                congestion_factor = (vehicles_per_hour / (max(1, connecting_roads) * speed)) * position_factor
                
                congestion[node_id] = {
                    'level': min(congestion_factor, 1.0),
                    'vehicles_per_hour': vehicles_per_hour,
                    'connecting_roads': connecting_roads,
                    'name': node['name']
                }
                
                node_details[node_id] = {
                    'name': node['name'],
                    'x': node['x'],
                    'y': node['y']
                }
        
        return {
            'path': [p for p in path],
            'total_distance': total_distance,
            'time_per_vehicle': time_per_vehicle * 60,  # Convert to minutes
            'vehicles_per_hour': vehicles_per_hour,
            'congestion': congestion,
            'node_details': node_details
        }
    
    def get_connecting_roads(self, node_id):
        """Get all roads connected to a node"""
        return list(self.links.find({
            '$or': [
                {'node1': node_id},
                {'node2': node_id}
            ]
        }))

class RoadNetwork:
    def __init__(self, nodes_collection, links_collection):
        self.nodes = nodes_collection
        self.links = links_collection
        # Define road structure
        self.roads = {
            'horizontal': {
                'y': 400,
                'x_range': (0, 1000)
            },
            'verticals': [
                {'x': 150, 'y_range': (0, 800)},
                {'x': 500, 'y_range': (0, 800)},
                {'x': 850, 'y_range': (0, 800)}
            ]
        }

    def is_point_on_road(self, x, y):
        """Check if a point lies on any road"""
        # Check horizontal road
        if abs(y - self.roads['horizontal']['y']) < 5:
            return True
            
        # Check vertical roads
        for road in self.roads['verticals']:
            if abs(x - road['x']) < 5:
                return True
        return False

    def get_nearest_vertical(self, x):
        """Get nearest vertical road x-coordinate"""
        return min(self.roads['verticals'], key=lambda r: abs(r['x'] - x))['x']

    def find_path(self, start_node_id, end_node_id):
        """Find path between two nodes following road network"""
        start_node = self.nodes.find_one({'id': start_node_id})
        end_node = self.nodes.find_one({'id': end_node_id})
        
        if not start_node or not end_node:
            return [], float('inf')

        x1, y1 = float(start_node['x']), float(start_node['y'])
        x2, y2 = float(end_node['x']), float(end_node['y'])
        
        # Get nearest vertical roads
        v1 = self.get_nearest_vertical(x1)
        v2 = self.get_nearest_vertical(x2)
        
        path = [start_node_id]
        total_distance = 0
        
        # Find existing nodes at key intersections
        def find_intersection_node(x, y):
            node = self.nodes.find_one({
                'x': {'$gte': x - 5, '$lte': x + 5},
                'y': {'$gte': y - 5, '$lte': y + 5}
            })
            return node['id'] if node else None

        # If start and end are on different vertical roads
        if v1 != v2:
            # Add intersection at first vertical road if not already there
            if abs(x1 - v1) > 5:
                intersection = find_intersection_node(v1, y1)
                if intersection:
                    path.append(intersection)
                total_distance += abs(x1 - v1)

            # Add intersection at horizontal road
            h_intersection1 = find_intersection_node(v1, self.roads['horizontal']['y'])
            if h_intersection1:
                path.append(h_intersection1)
            total_distance += abs(y1 - self.roads['horizontal']['y'])

            # Move along horizontal road
            h_intersection2 = find_intersection_node(v2, self.roads['horizontal']['y'])
            if h_intersection2:
                path.append(h_intersection2)
            total_distance += abs(v2 - v1)

            # Move to end node's vertical position
            if abs(x2 - v2) > 5:
                v_intersection = find_intersection_node(v2, y2)
                if v_intersection:
                    path.append(v_intersection)
                total_distance += abs(y2 - self.roads['horizontal']['y'])
                total_distance += abs(x2 - v2)

        else:
            # Direct vertical movement
            intersection = find_intersection_node(v1, y2)
            if intersection:
                path.append(intersection)
            total_distance += abs(y2 - y1)
            if abs(x2 - v1) > 5:
                total_distance += abs(x2 - v1)

        path.append(end_node_id)
        return path, round(total_distance / 100, 2)  # Convert to kilometers

class SimpleTrafficSimulator:
    def __init__(self, nodes_collection, links_collection):
        self.nodes = nodes_collection
        self.links = links_collection

    def calculate_distance(self, node1, node2):
        dx = float(node2['x']) - float(node1['x'])
        dy = float(node2['y']) - float(node1['y'])
        distance = math.sqrt(dx * dx + dy * dy)
        return round(distance / 100, 2)  # Convert to kilometers

    def simulate_traffic(self, vehicles, start_node_id, end_node_id, speed):
        start_node = self.nodes.find_one({'id': start_node_id})
        end_node = self.nodes.find_one({'id': end_node_id})
        
        if not start_node or not end_node:
            raise ValueError("Invalid start or end node")
        
        # Find the existing link and use its distance
        link = self.links.find_one({
            '$or': [
                {'node1': start_node_id, 'node2': end_node_id},
                {'node1': end_node_id, 'node2': start_node_id}
            ]
        })
        
        if not link:
            raise ValueError("No link exists between these nodes")
            
        total_distance = link['distance']  # Use existing link distance
        time_per_vehicle = total_distance / speed  # hours
        vehicles_per_hour = vehicles / time_per_vehicle
        
        # Simple congestion calculation
        congestion = {
            start_node_id: {
                'level': min(vehicles_per_hour / 1000, 1.0),
                'vehicles_per_hour': vehicles_per_hour,
                'connecting_roads': 1,
                'name': start_node['name']
            },
            end_node_id: {
                'level': min(vehicles_per_hour / 1000, 1.0),
                'vehicles_per_hour': vehicles_per_hour,
                'connecting_roads': 1,
                'name': end_node['name']
            }
        }
        
        return {
            'path': [start_node, end_node],
            'total_distance': total_distance,
            'time_per_vehicle': time_per_vehicle * 60,  # Convert to minutes
            'vehicles_per_hour': vehicles_per_hour,
            'congestion': congestion
        }

class GridPathFinder:
    def __init__(self, nodes_collection, links_collection):
        self.nodes = nodes_collection
        self.links = links_collection
        self.ROADS = {
            'horizontal': 400,
            'verticals': [150, 500, 850]
        }
    
    def find_or_create_intersection_node(self, x, y):
        """Find existing node at intersection or return None"""
        existing = self.nodes.find_one({
            'x': {'$gte': x - 1, '$lte': x + 1},
            'y': {'$gte': y - 1, '$lte': y + 1}
        })
        return existing['id'] if existing else None

    def get_path_points(self, start_node, end_node):
        """Calculate the sequence of points a path must follow along the road network"""
        x1, y1 = float(start_node['x']), float(start_node['y'])
        x2, y2 = float(end_node['x']), float(end_node['y'])
        
        # Find nearest vertical roads
        start_vertical = min(self.ROADS['verticals'], key=lambda v: abs(v - x1))
        end_vertical = min(self.ROADS['verticals'], key=lambda v: abs(v - x2))
        
        points = []
        intersection_nodes = []
        
        # Starting point
        points.append((x1, y1))
        intersection_nodes.append(start_node['id'])
        
        # Check for intersection at start vertical road
        if abs(x1 - start_vertical) > 1:  # If not already on vertical road
            points.append((start_vertical, y1))
            vert_node = self.find_or_create_intersection_node(start_vertical, y1)
            if vert_node:
                intersection_nodes.append(vert_node)
        
        # If nodes are on different vertical roads
        if start_vertical != end_vertical:
            # Add horizontal road intersection
            points.append((start_vertical, self.ROADS['horizontal']))
            horiz_node1 = self.find_or_create_intersection_node(start_vertical, self.ROADS['horizontal'])
            if horiz_node1:
                intersection_nodes.append(horiz_node1)
            
            # Move along horizontal road
            points.append((end_vertical, self.ROADS['horizontal']))
            horiz_node2 = self.find_or_create_intersection_node(end_vertical, self.ROADS['horizontal'])
            if horiz_node2:
                intersection_nodes.append(horiz_node2)
            
            # Go to end node's vertical position
            points.append((end_vertical, y2))
            vert_end_node = self.find_or_create_intersection_node(end_vertical, y2)
            if vert_end_node:
                intersection_nodes.append(vert_end_node)
        else:
            # Direct vertical movement
            points.append((start_vertical, y2))
            vert_node = self.find_or_create_intersection_node(start_vertical, y2)
            if vert_node:
                intersection_nodes.append(vert_node)
        
        # End point
        points.append((x2, y2))
        intersection_nodes.append(end_node['id'])
        
        return points, intersection_nodes
        
    def get_path_distance(self, points):
        """Calculate total distance along a path"""
        total = 0
        for i in range(len(points) - 1):
            x1, y1 = points[i]
            x2, y2 = points[i + 1]
            segment = abs(x2 - x1) + abs(y2 - y1)  # Manhattan distance
            total += segment
        return round(total / 100, 2)  # Convert to kilometers
        
    def dijkstra(self, start_node_id, end_node_id):
        """Find shortest path using grid-based routing"""
        start_node = self.nodes.find_one({'id': start_node_id})
        end_node = self.nodes.find_one({'id': end_node_id})
        
        if not start_node or not end_node:
            return [], float('inf')
        
        # Get path points and intersection nodes
        points, path_nodes = self.get_path_points(start_node, end_node)
        distance = self.get_path_distance(points)
        
        # Return full path including intersection nodes
        return path_nodes, distance

def calculate_distance(node1, node2):
    """Calculate distance using grid-based routing"""
    ROADS = {
        'horizontal': 400,
        'verticals': [150, 500, 850]
    }
    
    x1, y1 = float(node1['x']), float(node1['y'])
    x2, y2 = float(node2['x']), float(node2['y'])
    
    # Find nearest vertical roads
    start_vertical = min(ROADS['verticals'], key=lambda v: abs(v - x1))
    end_vertical = min(ROADS['verticals'], key=lambda v: abs(v - x2))
    
    total_distance = 0
    
    # Distance to vertical road
    total_distance += abs(x1 - start_vertical)
    
    if start_vertical != end_vertical:
        # Distance to horizontal road
        total_distance += abs(y1 - ROADS['horizontal'])
        # Distance along horizontal road
        total_distance += abs(end_vertical - start_vertical)
        # Distance to final vertical position
        total_distance += abs(y2 - ROADS['horizontal'])
    else:
        # Direct vertical movement
        total_distance += abs(y2 - y1)
    
    # Distance from vertical to destination
    total_distance += abs(x2 - end_vertical)
    
    return round(total_distance / 100, 2)  # Convert to kilometers


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'xml' not in request.files:
        return jsonify({'error': 'XML file is required'}), 400
    
    xml_file = request.files['xml']
    
    if xml_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if not xml_file.filename.endswith('.xml'):
        return jsonify({'error': 'File must be XML'}), 400
    
    try:
        xml_content = xml_file.read().decode('utf-8')
        print("Received XML content:", xml_content)  # Debug print
        
        # Register namespaces
        ET.register_namespace('', "http://www.w3.org/2000/svg")
        root = ET.fromstring(xml_content)
        print("Root tag:", root.tag)  # Debug print
        
        # Find map element
        map_elem = root.find('.//map')
        if map_elem is None:
            print("No map element found")  # Debug print
            return jsonify({'error': 'No map element found'}), 400
            
        print("Found map element")  # Debug print
        
        # Find SVG content - try multiple methods
        svg_elem = None
        
        # Method 1: Direct search
        svg_elem = map_elem.find('svg')
        if svg_elem is not None:
            print("Found SVG using direct search")
        
        # Method 2: Namespace search
        if svg_elem is None:
            svg_elem = map_elem.find('.//{http://www.w3.org/2000/svg}svg')
            if svg_elem is not None:
                print("Found SVG using namespace search")
        
        # Method 3: Non-namespace search
        if svg_elem is None:
            svg_elem = map_elem.find('.//svg')
            if svg_elem is not None:
                print("Found SVG using recursive search")
        
        if svg_elem is None:
            print("No SVG element found after all attempts")
            return jsonify({'error': 'No SVG element found'}), 400
            
        # Convert SVG element to string
        svg_content = ET.tostring(svg_elem, encoding='unicode', method='xml')
        print("Successfully converted SVG to string")  # Debug print
        
        # Get map dimensions
        width = int(map_elem.get('width', '800'))
        height = int(map_elem.get('height', '600'))
        
        map_data = {
            'width': width,
            'height': height,
            'svg': svg_content
        }
        
        # Clear existing data
        nodes_collection.delete_many({})
        links_collection.delete_many({})
        maps_collection.delete_many({})
        
        # Save map information
        maps_collection.insert_one(map_data)
        
        response_data = {
            'message': 'File uploaded successfully',
            'nodes': [],
            'map': map_data
        }
        return jsonify(json.loads(json_util.dumps(response_data)))
        
    except ET.ParseError as e:
        print(f"XML Parse Error: {str(e)}")  # Debug print
        return jsonify({'error': f'Invalid XML format: {str(e)}'}), 400
    except Exception as e:
        print(f"Upload error: {str(e)}")  # Debug print
        return jsonify({'error': str(e)}), 500

@app.route('/nodes')
def get_nodes():
    try:
        nodes = list(nodes_collection.find({}, {'_id': 0}))
        map_info = maps_collection.find_one({}, {'_id': 0})
        if not map_info:
            return jsonify({'nodes': [], 'map': None})
        
        response_data = {
            'nodes': nodes,
            'map': map_info
        }
        return jsonify(json.loads(json_util.dumps(response_data)))
    except Exception as e:
        print(f"Get nodes error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/links', methods=['POST'])
def create_link():
    try:
        data = request.json
        node1_id = str(data['node1'])
        node2_id = str(data['node2'])
        
        node1 = nodes_collection.find_one({'id': node1_id}, {'_id': 0})
        node2 = nodes_collection.find_one({'id': node2_id}, {'_id': 0})
        
        if not node1 or not node2:
            return jsonify({'error': 'Nodes not found'}), 404
        
        existing_link = links_collection.find_one({
            '$or': [
                {'node1': node1_id, 'node2': node2_id},
                {'node1': node2_id, 'node2': node1_id}
            ]
        })
        
        if existing_link:
            return jsonify({'error': 'Link already exists'}), 400
        
        distance = calculate_distance(node1, node2)
        
        link = {
            'node1': node1_id,
            'node2': node2_id,
            'distance': distance,
            'node1_name': node1['name'],
            'node2_name': node2['name']
        }
        
        result = links_collection.insert_one(link)
        response_link = {**link, '_id': str(result.inserted_id)}
        
        return jsonify(json.loads(json_util.dumps(response_link)))
    except Exception as e:
        print(f"Create link error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/links')
def get_links():
    try:
        links = list(links_collection.find({}, {'_id': 0}))
        return jsonify(json.loads(json_util.dumps(links)))
    except Exception as e:
        print(f"Get links error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/clear', methods=['POST'])
def clear_data():
    try:
        nodes_collection.delete_many({})
        links_collection.delete_many({})
        maps_collection.delete_many({})
        
        return jsonify({'message': 'All data cleared successfully'})
    except Exception as e:
        print(f"Clear data error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/reset', methods=['POST'])
def reset_database():
    try:
        db.drop_collection('nodes')
        db.drop_collection('links')
        db.drop_collection('maps')
        return jsonify({'message': 'Database reset successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/simulate', methods=['POST'])
def simulate_traffic():
    try:
        data = request.json
        vehicles = int(data['vehicles'])
        start_node = data['start_node']
        end_node = data['end_node']
        speed = float(data['speed'])
        
        if vehicles <= 0 or speed <= 0:
            return jsonify({'error': 'Invalid vehicles count or speed'}), 400
            
        simulator = SimpleTrafficSimulator(nodes_collection, links_collection)
        results = simulator.simulate_traffic(vehicles, start_node, end_node, speed)
        
        return jsonify(json.loads(json_util.dumps(results)))
    except Exception as e:
        print(f"Simulation error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/nodes', methods=['POST'])
def create_node():
    try:
        node_data = request.json
        result = nodes_collection.insert_one(node_data)
        node_data['_id'] = str(result.inserted_id)
        return jsonify(node_data)
    except Exception as e:
        print(f"Error creating node: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/nodes/<node_id>', methods=['DELETE'])
def delete_node(node_id):
    try:
        # Delete node
        result = nodes_collection.delete_one({'id': node_id})
        if result.deleted_count == 0:
            return jsonify({'error': 'Node not found'}), 404
            
        # Delete associated links
        links_collection.delete_many({
            '$or': [
                {'node1': node_id},
                {'node2': node_id}
            ]
        })
        
        return jsonify({'message': 'Node and associated links deleted successfully'})
    except Exception as e:
        print(f"Error deleting node: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5001)