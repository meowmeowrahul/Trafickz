#include "AgentTypes.h"
#include "SimConfig.h"
#include "../network/RoadGraph.h"
#include <random>
#include <algorithm>

const AgentProfile get_agent_profile(AgentType type) {
    static const AgentProfile profiles[] = {
        {0.8, 2.0, 1.3, 3.0, 4.5, 2.5, 16.67, 35.0 * M_PI/180.0, 4}, // TWO_WHEELER
        {1.4, 2.6, 2.0, 1.5, 3.0, 2.0, 11.11, 35.0 * M_PI/180.0, 5}, // AUTO_RICKSHAW
        {1.8, 4.5, 3.0, 2.5, 4.0, 2.0, 13.89, 35.0 * M_PI/180.0, 4}, // CAR
        {2.5, 10.0, 6.0, 1.0, 3.0, 1.0, 11.11, 30.0 * M_PI/180.0, 4},// BUS
        {0.5, 0.5, 0.0, 1.5, 3.0, 1.5, 1.8, 180.0 * M_PI/180.0, 0}   // PEDESTRIAN
    };
    return profiles[static_cast<int>(type)];
}

void compute_hull(AgentState& state, const SimConfig& config) {
    AgentProfile profile = get_agent_profile(state.type);
    if (state.type == AgentType::CAR) {
        if (config.car_width > 0) profile.width = config.car_width;
        if (config.car_length > 0) profile.length = config.car_length;
    }
    state.hull_size = profile.hull_type;
    if (state.hull_size == 0) return; // Pedestrian

    Vec2 forward = Vec2(std::cos(state.heading), std::sin(state.heading));
    Vec2 right = forward.perpendicular(); 
    
    double hw = profile.width / 2.0;
    double hl = profile.length / 2.0;
    
    // Simplification: position is center of the bounding box.
    Vec2 center = state.position + forward * (profile.length / 2.0);
    if (state.hull_size == 4) {
        state.hull[0] = center + forward * hl + right * hw;
        state.hull[1] = center + forward * hl - right * hw;
        state.hull[2] = center - forward * hl - right * hw;
        state.hull[3] = center - forward * hl + right * hw;
    } else if (state.hull_size == 5) {
        // 5-point wedge for auto-rickshaw
        double taper_len = profile.length * 0.6; // tapered front at 60%
        state.hull[0] = center + forward * hl; // front tip
        state.hull[1] = center + forward * (hl - taper_len) - right * hw;
        state.hull[2] = center - forward * hl - right * hw;
        state.hull[3] = center - forward * hl + right * hw;
        state.hull[4] = center + forward * (hl - taper_len) + right * hw;
    }
}

void init_agents_on_roads(std::vector<AgentState>& agents, int count, const RoadGraph& graph, std::mt19937& rng, const SimConfig& config) {
    agents.resize(count);
    std::discrete_distribution<int> dist_type({40, 15, 35, 10});
    std::uniform_real_distribution<double> dist_speed(2.0, 8.0);

    for (int i = 0; i < count; ++i) {
        agents[i].id = i;
        agents[i].type = static_cast<AgentType>(dist_type(rng));
        
        AgentProfile profile = get_agent_profile(agents[i].type);
        if (agents[i].type == AgentType::CAR) {
            if (config.car_width > 0) profile.width = config.car_width;
            if (config.car_length > 0) profile.length = config.car_length;
        }
        
        std::uniform_real_distribution<double> dist_var(0.8, 1.2);
        agents[i].max_speed = profile.max_speed * dist_var(rng);
        agents[i].max_accel = profile.max_accel * dist_var(rng);
        agents[i].max_decel = profile.max_decel * dist_var(rng);
        agents[i].comfortable_decel = profile.comfortable_decel * dist_var(rng);
        
        agents[i].steer_angle = 0.0;
        agents[i].current_edge_idx = -1;
        agents[i].current_waypoint_idx = -1;
        agents[i].route_segment_idx = 0;
        agents[i].waypoint_idx = 0;
        agents[i].tactical_state = TacticalState::FREE_FLOW;
        agents[i].squeeze_cooldown = 0.0;

        if (graph.segments.empty()) {
            std::uniform_real_distribution<double> dist_x(-500.0, 500.0);
            std::uniform_real_distribution<double> dist_y(-500.0, 500.0);
            std::uniform_real_distribution<double> dist_h(-M_PI, M_PI);
            agents[i].position = {dist_x(rng), dist_y(rng)};
            agents[i].heading = dist_h(rng);
            agents[i].lateral_offset = 0.0;
        } else {
            // For calibration/testing, place agents in a uniform pattern to avoid initial crashes
            const RoadSegment& seg = graph.segments.front();
            
            AgentProfile profile = get_agent_profile(agents[i].type);
            if (agents[i].type == AgentType::CAR) {
                if (config.car_width > 0) profile.width = config.car_width;
                if (config.car_length > 0) profile.length = config.car_length;
            }
            
            double max_offset = std::max(0.0, seg.width / 2.0 - profile.width / 2.0 - 0.3);
            
            agents[i].route = { 0 };
            agents[i].route_segment_idx = 0;
            
            if (!seg.centerline.empty() && seg.centerline.size() > 1) {
                agents[i].waypoint_idx = 1;
                
                // Distribute evenly along the total length
                double spacing = seg.length / count;
                double t = (i * spacing) / seg.length;
                
                Vec2 dir = (seg.centerline[1] - seg.centerline[0]).normalized();
                Vec2 base_pos = seg.centerline[0] + (seg.centerline[1] - seg.centerline[0]) * t;
                
                // Distribute laterally into discrete lanes
                int num_lanes = std::max(1, (int)(seg.width / 3.0));
                int lane = i % num_lanes;
                agents[i].lateral_offset = -seg.width / 2.0 + 1.5 + lane * 3.0;
                
                agents[i].heading = std::atan2(dir.y, dir.x);
                agents[i].position = base_pos + dir.perpendicular() * agents[i].lateral_offset;
            } else {
                agents[i].position = seg.centerline[0];
            }
            agents[i].speed = seg.speed_limit * 0.7; // Start at cruising speed
        }
        compute_hull(agents[i], config);
    }
}
