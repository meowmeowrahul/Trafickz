#include "FSM.h"
#include <cmath>

void update_tactical_state(AgentState& ego, const std::vector<AgentState>& neighbors, const SimConfig& config) {
    const auto& profile = get_agent_profile(ego.type);
    
    if (ego.squeeze_cooldown > 0) {
        ego.squeeze_cooldown -= config.dt;
    }

    if (ego.tactical_state == TacticalState::FREE_FLOW && ego.squeeze_cooldown <= 0) {
        bool slow_leader = false;
        Vec2 forward(std::cos(ego.heading), std::sin(ego.heading));
        for (const auto& n : neighbors) {
            Vec2 to_n = n.position - ego.position;
            if (to_n.length() < 15.0 && forward.dot(to_n) > 0) {
                // Trigger when ego is being slowed below 75% of max speed by a slower neighbor
                if (n.speed < ego.speed && ego.speed < 0.75 * profile.max_speed) {
                    slow_leader = true;
                    break;
                }
            }
        }
        if (slow_leader) {
            ego.tactical_state = TacticalState::EVALUATE_GAP;
        }
    } else if (ego.tactical_state == TacticalState::EVALUATE_GAP) {
        bool gap_left = true, gap_right = true;
        Vec2 forward(std::cos(ego.heading), std::sin(ego.heading));
        Vec2 right = forward.perpendicular();
        
        for (const auto& n : neighbors) {
            Vec2 to_n = n.position - ego.position;
            double dist = to_n.length();
            if (dist < 10.0) {
                double lon = forward.dot(to_n);
                double lat = right.dot(to_n);
                if (lon > -2.0 && lon < 8.0) {
                    if (lat < -0.5 && lat > -(profile.width + 1.5)) gap_left = false;
                    if (lat > 0.5 && lat < (profile.width + 1.5)) gap_right = false;
                }
            }
        }
        
        if (gap_left) {
            ego.tactical_state = TacticalState::SQUEEZE_LEFT;
            ego.squeeze_duration = 0.0;
            ego.squeeze_cooldown = 0.0;
        } else if (gap_right) {
            ego.tactical_state = TacticalState::SQUEEZE_RIGHT;
            ego.squeeze_duration = 0.0;
            ego.squeeze_cooldown = 0.0;
        } else {
            // Keep waiting in EVALUATE_GAP
        }
    } else if (ego.tactical_state == TacticalState::SQUEEZE_LEFT || ego.tactical_state == TacticalState::SQUEEZE_RIGHT) {
        ego.squeeze_duration += config.dt;
        
        Vec2 forward(std::cos(ego.heading), std::sin(ego.heading));
        bool overtake_complete = false;
        for (const auto& n : neighbors) {
            Vec2 to_n = n.position - ego.position;
            double lon = forward.dot(to_n);
            // If the slow leader is now BEHIND us, overtake succeeded
            if (lon < -profile.length) {
                overtake_complete = true;
                break;
            }
        }
        
        if (overtake_complete || ego.squeeze_duration > 2.0) {
            ego.tactical_state = TacticalState::FREE_FLOW;
            ego.squeeze_cooldown = 0.5;
            ego.squeeze_duration = 0.0;
        }
    }
}
