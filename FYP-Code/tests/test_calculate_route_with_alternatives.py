import unittest
from unittest.mock import Mock, patch
import networkx as nx
import json
from datetime import datetime
import mongomock
import osmnx as ox

class TestTrafficSimulation(unittest.TestCase):
    def setUp(self):
        """Set up test environment before each test"""
        # Create mock MongoDB collections
        self.mock_current_traffic = mongomock.MongoClient().db.collection
        
        # Sample road network for testing
        self.G = nx.DiGraph()
        self.G.add_edge(1, 2, length=100, lanes=2, speed_limit=60)
        self.G.add_edge(2, 3, length=200, lanes=2, speed_limit=50)
        self.G.add_edge(3, 4, length=150, lanes=3, speed_limit=70)
        
        # Sample modification scenario
        self.modification = {
            'road_id': 'road_1',
            'segment': (1, 2),
            'changes': {
                'lanes': 3,  # Increase lanes from 2 to 3
                'speed_limit': 70  # Increase speed limit from 60 to 70
            }
        }
        
        # Sample traffic flow data
        self.traffic_data = {
            'road_1': {
                'current_flow': 1200,  # vehicles per hour
                'capacity': 1800
            },
            'road_2': {
                'current_flow': 900,
                'capacity': 1500
            }
        }

        # Create patchers
        self.patchers = [
            patch('app.current_traffic_data', self.mock_current_traffic),
            patch('app.G', self.G)
        ]
        
        # Start all patchers
        for patcher in self.patchers:
            patcher.start()

    def tearDown(self):
        """Clean up after each test"""
        # Stop all patchers
        for patcher in self.patchers:
            patcher.stop()

    def test_simulate_road_modification(self):
        """Test basic road modification simulation"""
        from app import simulate_road_modification
        
        result = simulate_road_modification(self.modification)
        
        # Verify simulation returns expected format
        self.assertIn('impact_metrics', result)
        self.assertIn('affected_segments', result)
        self.assertIn('flow_changes', result)
        
        # Check impact metrics structure
        impact = result['impact_metrics']
        self.assertIn('travel_time_change', impact)
        self.assertIn('capacity_change', impact)
        self.assertIn('congestion_index', impact)

    def test_capacity_calculation(self):
        """Test road capacity calculations after modifications"""
        from app import calculate_road_capacity
        
        # Test capacity calculation for different number of lanes
        original_capacity = calculate_road_capacity(lanes=2, speed_limit=60)
        modified_capacity = calculate_road_capacity(lanes=3, speed_limit=60)
        
        # Verify capacity increases with additional lane
        self.assertGreater(modified_capacity, original_capacity)
        
        # Verify reasonable capacity values (vehicles per hour per lane)
        self.assertTrue(800 <= original_capacity/2 <= 2000)  # per lane capacity
        self.assertTrue(800 <= modified_capacity/3 <= 2000)  # per lane capacity

    def test_ripple_effect_calculation(self):
        """Test calculation of traffic impact on surrounding roads"""
        from app import calculate_ripple_effects
        
        affected_roads = calculate_ripple_effects(
            self.G,
            modified_segment=(1, 2),
            radius=2  # Number of hops to analyze
        )
        
        # Verify affected roads include directly connected segments
        self.assertIn((2, 3), affected_roads)
        
        # Verify impact decreases with distance
        for road, impact in affected_roads.items():
            if road == (1, 2):  # Modified segment
                self.assertGreater(impact['flow_change'], 0)
            elif road == (2, 3):  # Adjacent segment
                self.assertLess(abs(impact['flow_change']), 
                              abs(affected_roads[(1, 2)]['flow_change']))

    def test_congestion_prediction(self):
        """Test prediction of congestion changes"""
        from app import predict_congestion_changes
        
        modified_network = self.G.copy()
        modified_network[1][2]['lanes'] = 3  # Modify number of lanes
        
        predictions = predict_congestion_changes(
            original_network=self.G,
            modified_network=modified_network,
            current_traffic=self.traffic_data
        )
        
        # Verify predictions for modified segment
        self.assertIn('road_1', predictions)
        self.assertLess(predictions['road_1']['congestion_index'], 
                       self.traffic_data['road_1']['current_flow'] / 
                       self.traffic_data['road_1']['capacity'])

    def test_invalid_modification(self):
        """Test handling of invalid road modifications"""
        from app import simulate_road_modification
        
        invalid_modification = {
            'road_id': 'nonexistent_road',
            'segment': (99, 100),
            'changes': {
                'lanes': 3
            }
        }
        
        with self.assertRaises(ValueError):
            simulate_road_modification(invalid_modification)

    def test_network_constraints(self):
        """Test enforcement of network constraints"""
        from app import validate_network_modification
        
        # Test invalid number of lanes
        invalid_lanes = {
            'road_id': 'road_1',
            'segment': (1, 2),
            'changes': {
                'lanes': 0  # Invalid number of lanes
            }
        }
        self.assertFalse(validate_network_modification(invalid_lanes))
        
        # Test invalid speed limit
        invalid_speed = {
            'road_id': 'road_1',
            'segment': (1, 2),
            'changes': {
                'speed_limit': 200  # Unreasonably high speed limit
            }
        }
        self.assertFalse(validate_network_modification(invalid_speed))

    def test_simulation_results_persistence(self):
        """Test storage of simulation results"""
        from app import simulate_and_store_results
        
        result = simulate_and_store_results(self.modification)
        
        # Verify results are stored in database
        stored_results = self.mock_current_traffic.find_one({
            'simulation_id': result['simulation_id']
        })
        
        self.assertIsNotNone(stored_results)
        self.assertEqual(stored_results['modification'], self.modification)
        self.assertIn('timestamp', stored_results)
        self.assertIn('impact_metrics', stored_results)

if __name__ == '__main__':
    unittest.main()