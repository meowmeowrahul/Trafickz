#ifndef CORE_AGENTTYPES_H
#define CORE_AGENTTYPES_H

#include <cstdint>
#include <vector>
#include <array>
#include <random>
#include "../math/Vec2.h"

enum class AgentType : uint8_t {
    TWO_WHEELER   = 0,
    AUTO_RICKSHAW = 1,
    CAR           = 2,
    BUS           = 3,
    PEDESTRIAN    = 4
};

struct AgentProfile {
    double width;
    double length;
    double wheelbase;
    double max_accel;
    double max_decel;
    double max_speed;
    double max_steer;
    int hull_type; // 0=none(circle), 4=4-pt rect, 5=5-pt wedge
};

const AgentProfile& get_agent_profile(AgentType type);

enum class TacticalState : uint8_t {
    FREE_FLOW      = 0,
    EVALUATE_GAP   = 1,
    SQUEEZE_LEFT   = 2,
    SQUEEZE_RIGHT  = 3,
    YIELD          = 4,
    TURNING        = 5
};

struct AgentState {
    int id;
    AgentType type;
    Vec2 position;
    double heading; // radians
    double speed;   // m/s
    double steer_angle;
    int current_edge_idx;
    int current_waypoint_idx;
    std::array<Vec2, 5> hull;
    int hull_size;
    std::vector<int> neighbor_indices;
    std::vector<int> route;
    int route_segment_idx = 0;
    int waypoint_idx = 0;
    double lateral_offset = 0.0;
    TacticalState tactical_state = TacticalState::FREE_FLOW;
    double squeeze_cooldown = 0.0;
};

void compute_hull(AgentState& state);
class RoadGraph;
void init_agents_on_roads(std::vector<AgentState>& agents, int count, const RoadGraph& graph, std::mt19937& rng);

#endif
