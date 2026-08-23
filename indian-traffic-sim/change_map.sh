#!/bin/bash

if [ -z "$1" ]; then
    echo "Usage: ./change_map.sh '<location_query>' [radius_in_meters]"
    echo "Example: ./change_map.sh 'Sion Circle, Mumbai' 600"
    echo "Note: A radius of 600 meters gives a 1200x1200m map."
    exit 1
fi

QUERY=$1
RADIUS=${2:-500}

echo "Changing map to: $QUERY with radius $RADIUS meters..."
cd "$(dirname "$0")/map_pipeline"
source venv/bin/activate
python extract_map.py "$QUERY" "$RADIUS"

echo ""
echo "Map successfully updated! Restart the traffic_sim engine to see the new map."
