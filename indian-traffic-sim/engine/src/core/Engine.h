#ifndef CORE_ENGINE_H
#define CORE_ENGINE_H

#include "SimConfig.h"
#include "AgentTypes.h"
#include "../network/NetTypes.h"
#include "../network/RoadGraph.h"
#include "../network/SpatialHash.h"
#include "../network/WebSocketServer.h"
#include <vector>
#include <atomic>

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
    NetMap net_map_;
    RoadGraph road_graph_;
    std::vector<AgentState> state_read_, state_write_;
    std::mt19937 rng_{42};
    SpatialHash spatial_hash_;
    WebSocketServer ws_server_;
    std::atomic<bool> running_{false};
    double sim_time_ = 0.0;
};

#endif
