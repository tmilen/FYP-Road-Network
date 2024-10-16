from flask import Flask, render_template
from database import get_top_congested_roads
from map import create_bottleneck_map

app = Flask(__name__)

@app.route('/')
def home():
    # Fetch the top 10 congested roads
    roads = get_top_congested_roads()
    
    # Generate the map
    map_html = create_bottleneck_map(roads)

    # Render the template with the map
    return render_template('map.html', map_html=map_html)

if __name__ == '__main__':
    app.run(debug=True)
