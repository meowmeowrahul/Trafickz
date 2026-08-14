#ifndef CORE_ENGINE_H
#define CORE_ENGINE_H

#include "SimConfig.h"
#include "AgentTypes.h"
#include "../network/NetTypes.h"
#include "../network/SpatialHash.h"
#include "../network/RoadGraph.h"
#include "../network/WebSocketServer.h"
#include "../obstacles/Obstacles.h"
#include <vector>
#include <atomic>
#include <random>
#include <unordered_map>

struct SpawnEvent {
    uint32_t track_id;
    double time;
    AgentType type;
    double speed;
    Vec2 entry;
    Vec2 exit;
};

class Engine {
public:
    explicit Engine(const SimConfig& config);
    void run();
    void stop();

private:
    void tick();
    void broadcast_state();

    SimConfig config_;
    std::atomic<int> pending_num_agents_{-1};
    std::atomic<double> pending_idm_T_{-1.0};
    std::atomic<double> pending_sfm_A_{-1.0};
    std::atomic<int> pending_barricades_{-1};
    std::atomic<int> pending_potholes_{-1};
    NetMap net_map_;
    RoadGraph road_graph_;
    ObstacleSet obstacles_;
    std::vector<AgentState> state_read_, state_write_;
    std::mt19937 rng_{42};
    SpatialHash spatial_hash_;
    WebSocketServer ws_server_;
    std::atomic<bool> running_{false};
    double sim_time_ = 0.0;
    
    // Headless metrics
    int flow_count_ = 0;
    double total_gap_ = 0.0;
    long long gap_samples_ = 0;
    uint64_t tick_count_ = 0;
    std::vector<double> gaps_timeseries_;
    
    // Phase 7 D2 & D3
    std::vector<SpawnEvent> spawn_schedule_;
    size_t next_spawn_idx_ = 0;
    struct TrackedTrajectory {
        std::vector<double> speed_profile;
        std::vector<double> tan_acc_profile;
        std::vector<double> lat_acc_profile;
    };
    std::unordered_map<uint32_t, TrackedTrajectory> tracked_trajectories_;
    int congestion_failures_ = 0;
};

#endif
