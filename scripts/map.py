import folium

def create_bottleneck_map(roads):
    singapore_coordinates = [1.3521, 103.8198]
    road_map = folium.Map(location=singapore_coordinates, zoom_start=12)

    for road in roads:
        name, lat, lon, congestion = road
        folium.Marker(
            location=[lat, lon],
            popup=f"{name} - Congestion Level: {congestion}",
            icon=folium.Icon(color='red', icon='info-sign')
        ).add_to(road_map)

    return road_map._repr_html_()
