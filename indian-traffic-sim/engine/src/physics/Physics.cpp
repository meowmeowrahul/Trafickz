#include "Physics.h"
#include "../tactics/FSM.h"
#include <cmath>
#include <algorithm>
#include <iostream>

static double normalize_angle(double angle) {
    while (angle > M_PI) angle -= 2.0 * M_PI;
    while (angle < -M_PI) angle += 2.0 * M_PI;
    return angle;
}

static double closest_point_distance_approx(const Vec2& c1, double hl1, const Vec2& c2, double hl2) {
    double dist = (c2 - c1).length();
    return dist - hl1 - hl2;
}

static Vec2 closest_point_on_polygon(const Vec2& center, const std::vector<Vec2>& hull) {
    double min_dist_sq = std::numeric_limits<double>::max();
    Vec2 closest_point = center;
    
    int hull_size = hull.size();
    if (hull_size == 0) return closest_point;
    
    for (int i = 0; i < hull_size; ++i) {
        Vec2 a = hull[i];
        Vec2 b = hull[(i + 1) % hull_size];
        Vec2 edge = b - a;
        double t = std::clamp((center - a).dot(edge) / edge.length_sq(), 0.0, 1.0);
        Vec2 proj = a + edge * t;
        double d_sq = Vec2::distance_sq(center, proj);
        if (d_sq < min_dist_sq) {
            min_dist_sq = d_sq;
            closest_point = proj;
        }
    }
    return closest_point;
}

void update_physics(const std::vector<AgentState>& read_state,
                    std::vector<AgentState>& write_state,
                    const SimConfig& config,
                    const RoadGraph& graph,
                    const ObstacleSet& obstacles) {
    
    #pragma omp parallel for schedule(static)
    for (size_t i = 0; i < read_state.size(); ++i) {
        const auto& ego = read_state[i];
        auto& next = write_state[i];
        next = ego; // copy previous state

        std::vector<AgentState> neighbors;
        for (int idx : ego.neighbor_indices) {
            neighbors.push_back(read_state[idx]);
        }
        update_tactical_state(next, neighbors, config);

        const auto& profile = get_agent_profile(ego.type);
        Vec2 forward(std::cos(ego.heading), std::sin(ego.heading));
        Vec2 right = forward.perpendicular();
        
        double max_accel = ego.max_accel;
        double comf_decel = (config.comf_decel > 0) ? config.comf_decel : ego.comfortable_decel;
        double max_braking_term = 0.0;
        double target_speed = ego.max_speed; 
        
        Vec2 waypoint_target = ego.position + forward * 10.0; 
        bool has_waypoint = false;
        
        if (ego.route_segment_idx < (int)ego.route.size()) {
            int seg_idx = ego.route[ego.route_segment_idx];
            if (seg_idx >= 0 && seg_idx < (int)graph.segments.size()) {
                const auto& seg = graph.segments[seg_idx];
                target_speed = std::min(target_speed, seg.speed_limit);
                if (ego.waypoint_idx < (int)seg.centerline.size()) {
                    Vec2 wpt = seg.centerline[ego.waypoint_idx];
                    Vec2 seg_dir = forward;
                    if (seg.centerline.size() > 1) {
                        if (ego.waypoint_idx == 0) {
                            seg_dir = (seg.centerline[1] - seg.centerline[0]).normalized();
                        } else {
                            seg_dir = (seg.centerline[ego.waypoint_idx] - seg.centerline[ego.waypoint_idx-1]).normalized();
                        }
                    }
                    waypoint_target = wpt + seg_dir.perpendicular() * ego.lateral_offset;
                    has_waypoint = true;

                    bool passed = false;
                    if ((ego.position - waypoint_target).length() < 3.0) {
                        passed = true;
                    } else if (seg_dir.dot(ego.position - waypoint_target) > 0.0) {
                        passed = true; // vehicle has crossed the perpendicular plane of the waypoint
                    }
                    
                    if (passed) {
                        next.waypoint_idx++;
                        if (next.waypoint_idx >= (int)seg.centerline.size()) {
                            // Safely extend route before advancing
                            if (next.route_segment_idx + 1 >= (int)next.route.size()) {
                                if (!seg.outgoing_segment_indices.empty()) {
                                    int dest = (next.id * 17 + next.route_segment_idx * 31) % graph.segments.size();
                                    std::vector<int> new_path = graph.get_shortest_path(seg_idx, dest);
                                    if (new_path.size() > 1) {
                                        for (size_t k = 1; k < new_path.size(); ++k) {
                                            next.route.push_back(new_path[k]);
                                        }
                                    } else {
                                        int pick = (next.id + next.route_segment_idx) % seg.outgoing_segment_indices.size();
                                        next.route.push_back(seg.outgoing_segment_indices[pick]);
                                    }
                                } else if (!next.route.empty()) {
                                    next.route.push_back(next.route[0]); // Loop back to start if dead-end
                                }
                            }
                            next.route_segment_idx++;
                            next.waypoint_idx = 0;
                        }
                    }
                }
            }
        } else {
            // Route completely exhausted
            has_waypoint = true;
            target_speed = 0.0; // Stop driving into the void
        }
        
        if (next.tactical_state == TacticalState::SQUEEZE_LEFT || next.tactical_state == TacticalState::SQUEEZE_RIGHT) {
            target_speed *= config.fsm_squeeze_speed_factor;
        } else if (next.tactical_state == TacticalState::TURNING) {
            target_speed = std::min(target_speed, config.fsm_turn_max_speed);
        } else if (next.tactical_state == TacticalState::YIELD) {
            target_speed = 0.0;
        }

        for (int n_idx : ego.neighbor_indices) {
            const auto& neighbor = read_state[n_idx];
            Vec2 to_neighbor = neighbor.position - ego.position;
            double dist = to_neighbor.length();
            if (dist < 1e-3) continue;

            if (forward.dot(to_neighbor) > 0) {
                const auto& n_profile = get_agent_profile(neighbor.type);
                double ego_lat = ego.position.dot(right);
                double n_lat = neighbor.position.dot(right);
                double ego_left = ego_lat - profile.width/2.0;
                double ego_right = ego_lat + profile.width/2.0;
                double leader_left = n_lat - n_profile.width/2.0;
                double leader_right = n_lat + n_profile.width/2.0;
                
                double overlap = std::max(0.0, std::min(ego_right, leader_right) - std::max(ego_left, leader_left));
                double omega = overlap / profile.width;
                
                if (omega > 0.01) {
                    double s_ij = std::max(0.1, closest_point_distance_approx(ego.position, profile.length/2.0, neighbor.position, n_profile.length/2.0) - 0.5);
                    double delta_v = ego.speed - neighbor.speed;
                    double s_star = config.idm_s0 + ego.speed * config.idm_T + 
                                    (ego.speed * delta_v) / (2.0 * std::sqrt(max_accel * comf_decel));
                    s_star = std::max(config.idm_s0, s_star);
                    double braking_term = omega * std::pow(s_star / s_ij, 2);
                    max_braking_term = std::max(max_braking_term, braking_term);
                }
            }
        }
        
        double accel = 0.0;
        if (target_speed < 0.01) {
            accel = -ego.max_decel;
        } else {
            accel = max_accel * (1.0 - std::pow(ego.speed / target_speed, 4) - max_braking_term);
        }
        
        if (config.enable_potholes) {
            for (const auto& pothole : obstacles.potholes) {
                double dist = (ego.position - pothole.center).length();
                if (dist < pothole.radius) {
                    if (accel > 0) accel *= (1.0 - pothole.severity);
                    else accel *= (1.0 - pothole.severity);
                    target_speed *= (1.0 - pothole.severity * 0.5);
                }
            }
        }

        Vec2 f_repulsive(0.0, 0.0);
        Vec2 f_asymmetric(0.0, 0.0);
        
        for (int n_idx : ego.neighbor_indices) {
            const auto& neighbor = read_state[n_idx];
            Vec2 to_neighbor = neighbor.position - ego.position;
            double dist = to_neighbor.length();
            if (dist > 1e-3 && dist < 10.0) {
                Vec2 dir_away = (to_neighbor * -1.0).normalized();
                double force_mag = config.sfm_A * std::exp(-dist / config.sfm_B);
                f_repulsive = f_repulsive + dir_away * force_mag;
                
                Vec2 n_forward(std::cos(neighbor.heading), std::sin(neighbor.heading));
                if (forward.dot(n_forward) < -0.5) {
                    double closing_speed = (ego.speed + neighbor.speed);
                    if (forward.x * to_neighbor.y - forward.y * to_neighbor.x > 0) { 
                        f_asymmetric = f_asymmetric + right * (config.sfm_asymmetric_weight * closing_speed);
                    } else { 
                        f_asymmetric = f_asymmetric - right * (config.sfm_asymmetric_weight * closing_speed);
                    }
                }
            }
        }

        Vec2 f_goal(0.0, 0.0);
        if (has_waypoint) {
            Vec2 dir_to_waypoint = (waypoint_target - ego.position).normalized();
            f_goal = (dir_to_waypoint * target_speed - forward * ego.speed) * (1.0 / config.sfm_tau) * config.sfm_goal_weight;
        }

        if (next.tactical_state == TacticalState::SQUEEZE_LEFT) {
            f_goal = f_goal - right * 2.0; 
        } else if (next.tactical_state == TacticalState::SQUEEZE_RIGHT) {
            f_goal = f_goal + right * 2.0; 
        }
        
        Vec2 f_obstacle(0.0, 0.0);
        if (config.enable_barricades) {
            for (const auto& barricade : obstacles.barricades) {
                Vec2 closest = closest_point_on_polygon(ego.position, barricade.hull);
                double dist = (ego.position - closest).length();
                if (dist < 8.0 && dist > 1e-3) {
                    Vec2 dir_away = (ego.position - closest).normalized();
                    double force_mag = config.sfm_A * 2.0 * std::exp(-dist / config.sfm_B);
                    force_mag = std::min(force_mag, 20.0); // cap force
                    f_obstacle = f_obstacle + dir_away * force_mag;
                }
            }
        }

        Vec2 f_total = f_goal + f_repulsive + f_asymmetric + f_obstacle;

        double desired_heading = ego.heading;
        double heading_delta = 0.0;
        if (f_total.length_sq() > 1e-6) {
            desired_heading = std::atan2(f_total.y, f_total.x);
            double raw_delta = normalize_angle(desired_heading - ego.heading);
            double gain = (ego.speed < 3.0) ? 0.15 : 0.05;
            heading_delta = raw_delta * gain;
        }

        double speed_new = std::clamp(ego.speed + accel * config.dt, 0.0, ego.max_speed);
        
        // Adaptive gain - tighter steering authority at low speed
        double speed_factor = 1.0 / (1.0 + ego.speed * 0.3);
        double adaptive_steer_limit = profile.max_steer * (1.0 + speed_factor);
        
        double steer = std::clamp(heading_delta, -adaptive_steer_limit, adaptive_steer_limit);
        
        double theta_new = ego.heading;
        if (profile.wheelbase < 0.01) {
            theta_new += heading_delta; 
        } else {
            if (ego.speed > 0.1) {
                theta_new += (speed_new / profile.wheelbase) * std::tan(steer) * config.dt;
            }
        }

        next.speed = speed_new;
        next.steer_angle = steer;
        next.heading = normalize_angle(theta_new);
        next.position.x = ego.position.x + speed_new * std::cos(next.heading) * config.dt;
        next.position.y = ego.position.y + speed_new * std::sin(next.heading) * config.dt;

        // --- Road Boundary Hard Constraint ---
        if (ego.route_segment_idx < (int)ego.route.size()) {
            int seg_idx = ego.route[ego.route_segment_idx];
            if (seg_idx >= 0 && seg_idx < (int)graph.segments.size()) {
                const auto& seg = graph.segments[seg_idx];
                if (seg.centerline.size() > 1) {
                    int wpt = std::min((int)seg.centerline.size() - 1, std::max(1, ego.waypoint_idx));
                    Vec2 p_a = seg.centerline[wpt - 1];
                    Vec2 p_b = seg.centerline[wpt];
                    
                    Vec2 edge = p_b - p_a;
                    double edge_len_sq = edge.length_sq();
                    if (edge_len_sq > 1e-6) {
                        double t = (next.position - p_a).dot(edge) / edge_len_sq;
                        Vec2 proj = p_a + edge * t;
                        
                        Vec2 offset_vec = next.position - proj;
                        double lateral_dist = offset_vec.length();
                        double max_offset = std::max(0.0, seg.width / 2.0 - profile.width / 2.0 - 0.1); // 0.1m safety margin
                        
                        if (lateral_dist > max_offset && lateral_dist > 1e-6) {
                            next.position = proj + offset_vec.normalized() * max_offset;
                        }
                    }
                }
            }
        }

        compute_hull(next, config);
    }
}
