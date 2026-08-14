import os
import sys
import json
import subprocess
import numpy as np
import pandas as pd
from scipy.spatial.distance import euclidean
from fastdtw import fastdtw

CSV_PATH = "/home/rahul/TruTraffic/dataset/DEL_4.csv"
ENGINE_BIN = os.path.abspath("../../engine/build/traffic_sim")

def get_agent_type(type_str):
    type_str = str(type_str).lower()
    if 'motorcycle' in type_str or 'two-wheeler' in type_str: return 0
    if 'auto' in type_str or 'rickshaw' in type_str: return 1
    if 'car' in type_str or 'taxi' in type_str: return 2
    if 'bus' in type_str: return 3
    if 'pedestrian' in type_str or 'ped' in type_str: return 4
    if 'bicycle' in type_str or 'cycle' in type_str: return 5
    if 'truck' in type_str or 'heavy' in type_str: return 6
    return 2

def transform_coords(x, y):
    # Rotate 180 degrees around (100, 0) to convert Left-To-Right dataset
    # into a Right-To-Left trajectory, matching our C++ test corridor (200 -> -100)
    return 200.0 - x, -y

def prepare_data():
    print(f"Loading {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    df = df.sort_values(by=['Track ID', 'Time [s]'])
    
    schedule = []
    trajectories = {}
    
    grouped = df.groupby('Track ID')
    for track_id, group in grouped:
        if len(group) < 5: continue
        first = group.iloc[0]
        entry_time = float(first['Time [s]'])
        if entry_time > 60.0: continue
        last = group.iloc[-1]
        
        atype = get_agent_type(first['Type'])
        speed_ms = float(first['Speed [km/h]']) / 3.6
        
        ex, ey = transform_coords(float(first['x [m]']), float(first['y [m]']))
        xx, xy = transform_coords(float(last['x [m]']), float(last['y [m]']))
        
        schedule.append({
            "track_id": int(track_id),
            "time": entry_time,
            "type": atype,
            "speed": speed_ms,
            "entry": [ex, ey],
            "exit": [xx, xy]
        })
        
        group = group.copy()
        group['Time_sec'] = group['Time [s]'].astype(int)
        
        # Mean aggregations per second
        speed_sec = group.groupby('Time_sec')['Speed [km/h]'].mean() / 3.6
        tan_sec = group.groupby('Time_sec')['Tan. Acc. [ms-2]'].mean()
        lat_sec = group.groupby('Time_sec')['Lat. Acc. [ms-2]'].mean()
        
        trajectories[str(track_id)] = {
            "speed": [float(v) for v in speed_sec.values],
            "tan_acc": [float(v) for v in tan_sec.values],
            "lat_acc": [float(v) for v in lat_sec.values]
        }
        
    schedule.sort(key=lambda x: x["time"])
    
    with open("val_schedule.json", "w") as f:
        json.dump(schedule, f, indent=2)
    with open("val_target.json", "w") as f:
        json.dump({"trajectories": trajectories}, f, indent=2)
        
    print(f"Prepared {len(schedule)} vehicles for validation.")
    return trajectories

def run_validation(target_trajs):
    # Load optimized params
    with open("optimized_params.json", "r") as f:
        params = json.load(f)
        
    cmd = [
        ENGINE_BIN,
        "--headless",
        "--duration", "60",
        "--schedule", "val_schedule.json",
        "--net_xml", "",
        "--idm_T", str(params["idm_T"]),
        "--idm_s0", str(params["idm_s0"]),
        "--comf_decel", str(params["comf_decel"]),
        "--sfm_A", str(params["sfm_A"]),
        "--sfm_B", str(params["sfm_B"])
    ]
    
    print(f"Running simulation with parameters: {params}")
    env = os.environ.copy()
    env["OMP_NUM_THREADS"] = "1"
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, text=True, env=env)
    
    lines = res.stdout.strip().split('\n')
    data = json.loads(lines[-1])
    sim_trajs = data.get("trajectories", {})
    congestion_failures = data.get("congestion_failures", 0)
    
    total_dtw = 0.0
    total_tan_mse = 0.0
    total_lat_mse = 0.0
    comparisons = 0
    
    for track_id_str, sim_data in sim_trajs.items():
        if track_id_str not in target_trajs: continue
        tgt_data = target_trajs[track_id_str]
        
        sim_speed = [v for v in sim_data["speed"] if v is not None]
        tgt_speed = tgt_data["speed"]
        sim_tan = [v for v in sim_data["tan_acc"] if v is not None]
        tgt_tan = tgt_data["tan_acc"]
        sim_lat = [v for v in sim_data["lat_acc"] if v is not None]
        tgt_lat = tgt_data["lat_acc"]
        
        if len(sim_speed) < 2 or len(tgt_speed) < 2: continue
        
        # DTW
        dtw_dist, _ = fastdtw(sim_speed, tgt_speed, radius=5, dist=lambda a, b: abs(a - b))
        total_dtw += dtw_dist / len(tgt_speed)
        
        # MSE Tan
        min_len_tan = min(len(sim_tan), len(tgt_tan))
        if min_len_tan >= 2:
            total_tan_mse += np.mean([(sim_tan[i] - tgt_tan[i])**2 for i in range(min_len_tan)])
            
        # MSE Lat
        min_len_lat = min(len(sim_lat), len(tgt_lat))
        if min_len_lat >= 2:
            total_lat_mse += np.mean([(sim_lat[i] - tgt_lat[i])**2 for i in range(min_len_lat)])
            
        comparisons += 1
        
    if comparisons == 0:
        print("Validation failed: No comparisons made.")
        return
        
    avg_dtw = total_dtw / comparisons
    avg_tan_mse = total_tan_mse / comparisons
    avg_lat_mse = total_lat_mse / comparisons
    
    w1, w2, w3 = 1.0, 0.055, 0.163
    loss = w1 * avg_dtw + w2 * avg_tan_mse + w3 * avg_lat_mse
    
    results_str = f"""
=== Validation Results ===
Dataset: DEL_4.csv
Comparisons: {comparisons}
Congestion Failures: {congestion_failures}
Average DTW: {avg_dtw:.4f}
Tan Acc MSE: {avg_tan_mse:.4f}
Lat Acc MSE: {avg_lat_mse:.4f}
Weighted Loss: {loss:.4f} (Weights: w1={w1}, w2={w2}, w3={w3})
"""
    print(results_str)
    with open("validation_results.txt", "w") as f:
        f.write(results_str.strip() + "\n")

if __name__ == "__main__":
    targets = prepare_data()
    run_validation(targets)
