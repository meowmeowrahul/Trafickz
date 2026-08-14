import os
import sys
import json
import subprocess
import numpy as np
from scipy.optimize import differential_evolution
from fastdtw import fastdtw
from scipy.spatial.distance import euclidean

# Paths
ENGINE_BIN = os.path.abspath("../../engine/build/traffic_sim")
METRICS_FILE = "target_metrics.json"
TRAJ_FILE = "target_trajectories.json"

# Load Targets
if not os.path.exists(TRAJ_FILE):
    print(f"Error: {TRAJ_FILE} not found. Run parse_ground_truth.py first.")
    sys.exit(1)

with open(TRAJ_FILE, 'r') as f:
    target_trajs = json.load(f)["trajectories"]

with open(METRICS_FILE, 'r') as f:
    metrics = json.load(f)

CAR_WIDTH = metrics.get("car_width", 2.0)
CAR_LENGTH = metrics.get("car_length", 5.0)

print(f"Loaded {len(target_trajs)} target trajectories for DTW. Car: {CAR_WIDTH}x{CAR_LENGTH}")

def exact_dtw(s, t):
    n, m = len(s), len(t)
    dtw_matrix = np.full((n+1, m+1), np.inf)
    dtw_matrix[0, 0] = 0
    for i in range(1, n+1):
        for j in range(1, m+1):
            cost = abs(s[i-1] - t[j-1])
            dtw_matrix[i, j] = cost + min(dtw_matrix[i-1, j],    # insertion
                                          dtw_matrix[i, j-1],    # deletion
                                          dtw_matrix[i-1, j-1])  # match
    return dtw_matrix[n, m]

def run_simulation(x):
    idm_T, idm_s0, comf_decel, sfm_A, sfm_B = x
    
    cmd = [
        ENGINE_BIN,
        "--headless",
        "--duration", "60",
        "--schedule", "inflow_schedule.json",
        "--idm_T", str(idm_T),
        "--idm_s0", str(idm_s0),
        "--comf_decel", str(comf_decel),
        "--sfm_A", str(sfm_A),
        "--sfm_B", str(sfm_B),
        "--car_width", str(CAR_WIDTH),
        "--car_length", str(CAR_LENGTH)
    ]
    
    try:
        env = os.environ.copy()
        env["OMP_NUM_THREADS"] = "1"
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20, text=True, env=env)
        if res.returncode != 0:
            return 1e6 # Penalize crashes
            
        # Parse JSON output from last line
        output_lines = res.stdout.strip().split('\n')
        json_line = output_lines[-1]
        data = json.loads(json_line)
        
        sim_trajs = data.get("trajectories", {})
        congestion_failures = data.get("congestion_failures", 0)
        
        total_dtw_dist = 0.0
        comparisons = 0
        
        for track_id_str, sim_t in sim_trajs.items():
            if track_id_str in target_trajs:
                tgt_t = target_trajs[track_id_str]
                if len(sim_t) < 2 or len(tgt_t) < 2:
                    continue
                # Clean sim_t of None values (which might be NaNs exported as null)
                sim_t = [v for v in sim_t if v is not None]
                if len(sim_t) < 2:
                    continue
                distance = exact_dtw(sim_t, tgt_t)
                total_dtw_dist += (distance / len(tgt_t))
                comparisons += 1
                
        if comparisons == 0:
            print("Comparisons == 0, sim_trajs size:", len(sim_trajs))
            return 1e6
            
        avg_dtw = total_dtw_dist / comparisons
        loss = avg_dtw + (congestion_failures * 100.0)
        return loss
        
    except subprocess.TimeoutExpired:
        print("TimeoutExpired")
        return 1e6
    except Exception as e:
        import traceback
        traceback.print_exc()
        print("Exception:", e)
        return 1e6

def optimize():
    # Bounds defined in PRD
    bounds = [
        (0.5, 2.5),  # idm_T
        (0.5, 3.0),  # idm_s0
        (1.0, 3.0),  # comf_decel
        (0.1, 5.0),  # sfm_A
        (0.1, 3.0)   # sfm_B
    ]
    
    print("Starting Genetic Algorithm (Differential Evolution)...")
    # workers=-1 uses all available CPU cores via multiprocessing.Pool
    result = differential_evolution(
        run_simulation, 
        bounds, 
        maxiter=50, 
        popsize=20, 
        workers=-1, 
        polish=False,
        disp=True
    )
    
    print("\n=== Optimization Complete ===")
    print(f"Best Loss: {result.fun:.4f}")
    best_params = result.x
    print(f"Optimal Parameters:")
    print(f"  idm_T:      {best_params[0]:.4f}")
    print(f"  idm_s0:     {best_params[1]:.4f}")
    print(f"  comf_decel: {best_params[2]:.4f}")
    print(f"  sfm_A:      {best_params[3]:.4f}")
    print(f"  sfm_B:      {best_params[4]:.4f}")
    
    # Save optimized parameters
    out_params = {
        "idm_T": best_params[0],
        "idm_s0": best_params[1],
        "comf_decel": best_params[2],
        "sfm_A": best_params[3],
        "sfm_B": best_params[4]
    }
    with open("optimized_params.json", 'w') as f:
        json.dump(out_params, f, indent=4)
    print("Saved to optimized_params.json")

if __name__ == "__main__":
    optimize()
