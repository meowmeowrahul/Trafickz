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

def run_simulation(x):
    idm_T, idm_s0, comf_decel, sfm_A, sfm_B = x
    
    cmd = [
        ENGINE_BIN,
        "--headless",
        "--duration", "60",
        "--schedule", "inflow_schedule.json",
        "--net_xml", "",
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
        
        total_dtw = 0.0
        total_tan_mse = 0.0
        total_lat_mse = 0.0
        comparisons = 0

        for track_id_str, sim_data in sim_trajs.items():
            if track_id_str not in target_trajs:
                continue
            tgt_data = target_trajs[track_id_str]

            # In older target files this might just be a list if not updated. Handle gracefully?
            # We assume it's dict-like since we re-ran parse_ground_truth.
            if isinstance(sim_data, list):
                print("Warning: sim_data is list! Please re-run parse_ground_truth or check engine output.")
                continue

            sim_speed = [v for v in sim_data.get("speed", []) if v is not None]
            tgt_speed = tgt_data.get("speed", [])
            sim_tan   = [v for v in sim_data.get("tan_acc", []) if v is not None]
            tgt_tan   = tgt_data.get("tan_acc", [])
            sim_lat   = [v for v in sim_data.get("lat_acc", []) if v is not None]
            tgt_lat   = tgt_data.get("lat_acc", [])

            if len(sim_speed) < 2 or len(tgt_speed) < 2:
                continue

            # Term 1: DTW on speed profile (trajectory shape)
            dtw_dist, _ = fastdtw(sim_speed, tgt_speed, radius=5,
                                  dist=lambda a, b: abs(a - b))
            total_dtw += dtw_dist / len(tgt_speed)

            # Term 2: MSE on longitudinal acceleration (IDM fit)
            min_len_tan = min(len(sim_tan), len(tgt_tan))
            if min_len_tan > 3:
                # Ignore first 3 seconds to allow rigid-box spawn collisions to untangle
                mse_tan = np.mean([(sim_tan[i] - tgt_tan[i])**2
                                   for i in range(3, min_len_tan)])
                total_tan_mse += mse_tan
            elif min_len_tan >= 2:
                mse_tan = np.mean([(sim_tan[i] - tgt_tan[i])**2
                                   for i in range(min_len_tan)])
                total_tan_mse += mse_tan

            # Term 3: MSE on lateral acceleration (SFM fit)
            min_len_lat = min(len(sim_lat), len(tgt_lat))
            if min_len_lat > 3:
                mse_lat = np.mean([(sim_lat[i] - tgt_lat[i])**2
                                   for i in range(3, min_len_lat)])
                total_lat_mse += mse_lat
            elif min_len_lat >= 2:
                mse_lat = np.mean([(sim_lat[i] - tgt_lat[i])**2
                                   for i in range(min_len_lat)])
                total_lat_mse += mse_lat

            comparisons += 1

        if comparisons == 0:
            print("Comparisons == 0, sim_trajs size:", len(sim_trajs))
            return 1e6

        avg_dtw     = total_dtw / comparisons
        avg_tan_mse = total_tan_mse / comparisons
        avg_lat_mse = total_lat_mse / comparisons

        # Weights — tuned so all terms contribute roughly equally (~3.2 each) based on baseline
        w1, w2, w3 = 1.0, 0.066, 0.187
        loss = w1 * avg_dtw + w2 * avg_tan_mse + w3 * avg_lat_mse

        print(f"[GA] cmp={comparisons} dtw={avg_dtw:.3f} "
              f"tan_mse={avg_tan_mse:.4f} lat_mse={avg_lat_mse:.4f} "
              f"loss={loss:.4f} fail={congestion_failures}",
              file=sys.stderr)

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
