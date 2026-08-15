import pandas as pd
import numpy as np
import json
import math
import os
import xml.etree.ElementTree as ET
import pyproj

CSV_PATH = "/home/rahul/TruTraffic/dataset/Micropscopic Vehicle Trajectories.csv"
SCHEDULE_PATH = "inflow_schedule.json"
TRAJ_PATH = "target_trajectories.json"
METRICS_PATH = "target_metrics.json"
NET_XML_PATH = "/home/rahul/TruTraffic/indian-traffic-sim/map_pipeline/map_output/network.net.xml"

def get_agent_type(type_str):
    type_str = str(type_str).lower()
    if 'motorcycle' in type_str or 'two-wheeler' in type_str: return 0
    if 'auto' in type_str or 'rickshaw' in type_str or 'tuk-tuk' in type_str: return 1
    if 'car' in type_str or 'taxi' in type_str: return 2
    if 'bus' in type_str: return 3
    if 'pedestrian' in type_str or 'ped' in type_str: return 4
    if 'bicycle' in type_str or 'cycle' in type_str: return 5
    if 'truck' in type_str or 'heavy' in type_str: return 6
    if 'medium' in type_str: return 7
    return 2 # default Car

def get_map_offset():
    # Option A: Calibration Mode uses raw CSV coordinates
    return 0.0, 0.0

def compute_metrics():
    print("Loading dataset for Phase 7...")
    try:
        df = pd.read_csv(CSV_PATH, sep=';', skipinitialspace=True, engine='python', 
                         usecols=['Track ID', 'Type', 'Track Width [m]', 'Track Length [m]', 'x [m]', 'y [m]', 'Speed [km/h]', 'Time [s]', 'Angle [rad]', 'Tan. Acc. [ms-2]', 'Lat. Acc. [ms-2]'])
    except Exception as e:
        print(f"Error loading CSV: {e}")
        return

    print(f"Loaded {len(df)} rows.")

    offset_x, offset_y = get_map_offset()
    print(f"Applying Map Offset: X={offset_x:.2f}, Y={offset_y:.2f}")

    df = df.sort_values(by=['Track ID', 'Time [s]'])

    schedule = []
    trajectories = {}

    grouped = df.groupby('Track ID')
    
    print("Extracting schedules and 1Hz trajectories...")
    for track_id, group in grouped:
        if len(group) < 5:
            continue
            
        first = group.iloc[0]
        entry_time = float(first['Time [s]'])
        
        # FIX 1: Only process vehicles that spawn in the first 60 seconds
        if entry_time > 60.0:
            continue
            
        last = group.iloc[-1]
        
        atype = get_agent_type(first['Type'])
        speed_ms = float(first['Speed [km/h]']) / 3.6
        
        # FIX 3: Apply map offset
        entry_x = float(first['x [m]']) + offset_x
        entry_y = float(first['y [m]']) + offset_y
        exit_x = float(last['x [m]']) + offset_x
        exit_y = float(last['y [m]']) + offset_y
        
        schedule.append({
            "track_id": int(track_id),
            "time": entry_time,
            "type": atype,
            "speed": speed_ms,
            "entry": [entry_x, entry_y],
            "exit": [exit_x, exit_y]
        })

        group['Time_sec'] = group['Time [s]'].astype(int)
        sec_grouped_speed = group.groupby('Time_sec')['Speed [km/h]'].mean() / 3.6
        sec_grouped_tan = group.groupby('Time_sec')['Tan. Acc. [ms-2]'].mean()
        sec_grouped_lat = group.groupby('Time_sec')['Lat. Acc. [ms-2]'].mean()
        
        trajectories[str(track_id)] = {
            "speed": [float(v) for v in sec_grouped_speed.values],
            "tan_acc": [float(v) for v in sec_grouped_tan.values],
            "lat_acc": [float(v) for v in sec_grouped_lat.values]
        }
        
    schedule.sort(key=lambda x: x["time"])

    with open(SCHEDULE_PATH, 'w') as f:
        json.dump(schedule, f, indent=2)
    print(f"Saved {len(schedule)} vehicles to {SCHEDULE_PATH}")

    with open(TRAJ_PATH, 'w') as f:
        json.dump({"trajectories": trajectories}, f, indent=2)
    print(f"Saved {len(trajectories)} trajectories to {TRAJ_PATH}")

    cars = df[df['Type'].str.contains('Car', case=False, na=False)]
    car_width = cars['Track Width [m]'].mean() if len(cars) > 0 else 2.0
    car_length = cars['Track Length [m]'].mean() if len(cars) > 0 else 5.0

    metrics = {
        "car_width": float(car_width),
        "car_length": float(car_length)
    }
    with open(METRICS_PATH, 'w') as f:
        json.dump(metrics, f, indent=4)
        
if __name__ == "__main__":
    compute_metrics()
