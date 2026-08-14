#include "Engine.h"
#include "../parser/NetXmlParser.h"
#include "../physics/Physics.h"
#include "../tactics/FSM.h"
#include "../collision/SAT.h"
#include <chrono>
#include <thread>
#include <iostream>
#include <algorithm>
#include <unordered_set>
#include <fstream>
#include <nlohmann/json.hpp>

Engine::Engine(const SimConfig& config)
    : config_(config),
      spatial_hash_(config.grid_cell_size, config.K_neighbors),
      ws_server_(config.ws_port) {
    if (!config_.net_xml_path.empty()) {
        net_map_ = NetXmlParser::parse(config_.net_xml_path);
    }
    road_graph_.build_from_net_map(net_map_);
    
    if (!config_.obstacles_json_path.empty()) {
        obstacles_.load_from_json(config_.obstacles_json_path);
    } else if (!config_.headless) {
        obstacles_.generate_random(road_graph_, 5, 10, rng_);
    }
    
    nlohmann::json j_msg;
    j_msg["type"] = "road_network";
    j_msg["edges"] = nlohmann::json::array();
    for (const auto& seg : road_graph_.segments) {
        nlohmann::json j_edge;
        j_edge["id"] = seg.edge_id;
        j_edge["width"] = seg.width;
        j_edge["centerline"] = nlohmann::json::array();
        for (const auto& pt : seg.centerline) {
            j_edge["centerline"].push_back({pt.x, pt.y});
        }
        j_msg["edges"].push_back(j_edge);
    }
    j_msg["junctions"] = nlohmann::json::array();
    for (const auto& [j_id, junc] : net_map_.junctions) {
        nlohmann::json j_junc;
        j_junc["id"] = junc.id;
        j_junc["position"] = {junc.position.x, junc.position.y};
        j_junc["shape"] = nlohmann::json::array();
        for (const auto& pt : junc.shape) {
            j_junc["shape"].push_back({pt.x, pt.y});
        }
        j_msg["junctions"].push_back(j_junc);
    }
    
    j_msg["barricades"] = nlohmann::json::array();
    for (const auto& barricade : obstacles_.barricades) {
        nlohmann::json j_b;
        j_b["id"] = barricade.id;
        j_b["hull"] = nlohmann::json::array();
        for (const auto& pt : barricade.hull) {
            j_b["hull"].push_back({pt.x, pt.y});
        }
        j_msg["barricades"].push_back(j_b);
    }
    
    j_msg["potholes"] = nlohmann::json::array();
    for (const auto& pothole : obstacles_.potholes) {
        nlohmann::json j_p;
        j_p["id"] = pothole.id;
        j_p["center"] = {pothole.center.x, pothole.center.y};
        j_p["radius"] = pothole.radius;
        j_p["severity"] = pothole.severity;
        j_msg["potholes"].push_back(j_p);
    }
    
    ws_server_.set_road_json(j_msg.dump());

    ws_server_.set_control_callback([this](int num_agents, double idm_t, double sfm_a, int enable_barricades, int enable_potholes) {
        if (num_agents > 0) this->pending_num_agents_ = num_agents;
        if (idm_t > 0) this->pending_idm_T_ = idm_t;
        if (sfm_a > 0) this->pending_sfm_A_ = sfm_a;
        if (enable_barricades != -1) this->pending_barricades_ = enable_barricades;
        if (enable_potholes != -1) this->pending_potholes_ = enable_potholes;
    });

    if (!config_.schedule_json_path.empty()) {
        std::ifstream f(config_.schedule_json_path);
        if (f.is_open()) {
            nlohmann::json j;
            f >> j;
            for (auto& item : j) {
                SpawnEvent ev;
                ev.track_id = item["track_id"];
                ev.time = item["time"];
                ev.type = static_cast<AgentType>(item["type"].get<int>());
                ev.speed = item["speed"];
                ev.entry = {item["entry"][0].get<double>(), item["entry"][1].get<double>()};
                ev.exit = {item["exit"][0].get<double>(), item["exit"][1].get<double>()};
                spawn_schedule_.push_back(ev);
            }
            std::cout << "[Engine] Loaded " << spawn_schedule_.size() << " spawn events.\n";
        }
    } else {
        init_agents_on_roads(state_read_, config_.num_agents, road_graph_, rng_, config_);
    }
    state_write_ = state_read_;
}

void Engine::run() {
    running_ = true;
    if (!config_.headless) {
        ws_server_.start();
        std::cout << "[Engine] Started. Agents=" << config_.num_agents 
                  << " dt=" << config_.dt << "s port=" << config_.ws_port << "\n";
    }

    auto tick_duration = std::chrono::duration<double>(config_.dt);

    while (running_) {
        auto start_time = std::chrono::steady_clock::now();

        tick();
        if (!config_.headless) {
            broadcast_state();
        }

        if (config_.headless && config_.duration > 0 && sim_time_ >= config_.duration) {
            double avg_gap = 0.0;
            for (double g : gaps_timeseries_) avg_gap += g;
            if (!gaps_timeseries_.empty()) avg_gap /= gaps_timeseries_.size();
            
            // Hydrodynamic flow: q = K * V_avg
            // K = N / L (where L is total road length in meters)
            double L = 0.0;
            for (const auto& seg : road_graph_.segments) L += seg.length;
            if (L == 0.0) L = 4000.0; // fallback test grid length
            
            double v_avg = 0.0;
            double v_max = 0.0;
            if (state_read_.size() > 0) {
                double total_speed = 0.0;
                for (const auto& agent : state_read_) {
                    total_speed += agent.speed;
                    if (agent.speed > v_max) v_max = agent.speed;
                }
                v_avg = total_speed / state_read_.size();
            }
            std::cerr << "[Debug] N=" << state_read_.size() << ", L=" << L << ", v_avg=" << v_avg << ", v_max=" << v_max << "\n";
            
            double density = state_read_.size() / L;
            double flow_rate = density * v_avg * 60.0; // veh/min
            
            nlohmann::json out;
            
            if (!spawn_schedule_.empty()) {
                out["congestion_failures"] = congestion_failures_;
                nlohmann::json j_traj = nlohmann::json::object();
                for (const auto& [id, traj] : tracked_trajectories_) {
                    j_traj[std::to_string(id)] = traj;
                }
                out["trajectories"] = j_traj;
            } else {
                out["flow"] = flow_rate;
                out["avg_gap"] = avg_gap;
                out["gaps_timeseries"] = gaps_timeseries_;
            }
            
            std::cout << out.dump() << "\n";
            running_ = false;
            break;
        }

        auto end_time = std::chrono::steady_clock::now();
        auto elapsed = end_time - start_time;
        double elapsed_ms = std::chrono::duration<double, std::milli>(elapsed).count();
        if (!config_.headless) {
            if (elapsed_ms > config_.max_step_ms) {
                std::cerr << "[Warning] Tick missed budget: " << elapsed_ms << "ms (budget: " << config_.max_step_ms << "ms)\n";
            }
            if (elapsed < tick_duration) {
                std::this_thread::sleep_for(tick_duration - elapsed);
            }
        }
    }
    if (!config_.headless) {
        ws_server_.stop();
    }
}

void Engine::stop() {
    running_ = false;
}

void Engine::tick() {
    int p_agents = pending_num_agents_.exchange(-1);
    if (p_agents > 0 && p_agents != config_.num_agents) {
        if (p_agents > config_.num_agents) {
            int to_add = p_agents - config_.num_agents;
            std::vector<AgentState> new_agents;
            init_agents_on_roads(new_agents, to_add, road_graph_, rng_, config_);
            int offset = state_read_.size();
            for (auto& a : new_agents) {
                a.id = offset++;
                state_read_.push_back(a);
                state_write_.push_back(a);
            }
        } else {
            state_read_.resize(p_agents);
            state_write_.resize(p_agents);
        }
        config_.num_agents = p_agents;
    }

    // Dynamic Spawning for Phase 7
    if (!spawn_schedule_.empty()) {
        while (next_spawn_idx_ < spawn_schedule_.size() && spawn_schedule_[next_spawn_idx_].time <= sim_time_) {
            const auto& ev = spawn_schedule_[next_spawn_idx_];
            
            AgentState new_agent;
            new_agent.id = ev.track_id;
            new_agent.type = ev.type;
            new_agent.position = ev.entry;
            new_agent.speed = ev.speed;
            new_agent.heading = 0.0;
            
            int start_seg = road_graph_.get_nearest_segment(ev.entry);
            int end_seg = road_graph_.get_nearest_segment(ev.exit);
            
            new_agent.route = road_graph_.get_shortest_path(start_seg, end_seg);
            if (new_agent.route.empty()) {
                new_agent.route.push_back(start_seg);
            }
            new_agent.route_segment_idx = 0;
            new_agent.current_edge_idx = new_agent.route[0];
            
            // Set capabilities randomly based on type
            AgentProfile prof = get_agent_profile(ev.type);
            if (ev.type == AgentType::CAR) {
                if (config_.car_width > 0) prof.width = config_.car_width;
                if (config_.car_length > 0) prof.length = config_.car_length;
            }
            
            std::uniform_real_distribution<double> dist_accel(0.8 * prof.max_accel, 1.2 * prof.max_accel);
            new_agent.max_accel = dist_accel(rng_);
            new_agent.max_decel = prof.max_decel;
            new_agent.max_speed = prof.max_speed;
            new_agent.comfortable_decel = (config_.comf_decel > 0) ? config_.comf_decel : prof.comfortable_decel;
            
            // Try to spawn. If occupied (SAT check), we tally a failure and spawn anyway (so simulation doesn't stall completely, but loss increases)
            compute_hull(new_agent, config_);
            bool occupied = false;
            for (const auto& a : state_read_) {
                if (a.hull_size > 0 && new_agent.hull_size > 0 && (a.position - new_agent.position).length() < 10.0) {
                    auto res = check_sat(a.hull.data(), a.hull_size, new_agent.hull.data(), new_agent.hull_size);
                    if (res.colliding) { occupied = true; break; }
                }
            }
            
            if (occupied) {
                congestion_failures_++;
            }
            
            state_read_.push_back(new_agent);
            state_write_.push_back(new_agent);
            next_spawn_idx_++;
        }
    }
    
    double p_idm = pending_idm_T_.exchange(-1.0);
    if (p_idm > 0) config_.idm_T = p_idm;
    
    double p_sfm = pending_sfm_A_.exchange(-1.0);
    if (p_sfm > 0) config_.sfm_A = p_sfm;

    int p_bar = pending_barricades_.exchange(-1);
    if (p_bar != -1) config_.enable_barricades = (p_bar == 1);
    
    int p_pot = pending_potholes_.exchange(-1);
    if (p_pot != -1) config_.enable_potholes = (p_pot == 1);

    spatial_hash_.clear();
    for (size_t i = 0; i < state_read_.size(); ++i) {
        spatial_hash_.insert(i, state_read_[i].position);
    }
    for (size_t i = 0; i < state_read_.size(); ++i) {
        state_read_[i].neighbor_indices = spatial_hash_.query_neighbors(state_read_[i].position, i, state_read_);
    }

    // Tactical state update has been moved to physics pass

    update_physics(state_read_, state_write_, config_, road_graph_, obstacles_);
    
    if (config_.headless) {
        double total_speed = 0.0;
        for (size_t i = 0; i < state_read_.size(); ++i) {
            total_speed += state_write_[i].speed;
            
            // Track average gap to vehicle directly ahead
            double min_gap = 100.0;
            bool found = false;
            Vec2 fwd(std::cos(state_write_[i].heading), std::sin(state_write_[i].heading));
            for (int n_idx : state_write_[i].neighbor_indices) {
                Vec2 to_n = state_write_[n_idx].position - state_write_[i].position;
                if (fwd.dot(to_n) > 0 && to_n.length() < min_gap) {
                    min_gap = to_n.length();
                    found = true;
                }
            }
            if (found) {
                total_gap_ += min_gap;
                gap_samples_++;
            }
        }
    }
    
    // Phase 7 D3: 1Hz Trajectory export
    if (config_.headless && !spawn_schedule_.empty()) {
        if (tick_count_ % 50 == 0) { // 1Hz tracking
            for (const auto& a : state_write_) {
                tracked_trajectories_[a.id].push_back(a.speed);
            }
        }
    } else if (config_.headless) {
        if (tick_count_ % 5 == 0) {
            double frame_avg = (gap_samples_ > 0) ? (total_gap_ / gap_samples_) : 0.0;
            gaps_timeseries_.push_back(frame_avg);
            // Reset for next frame to get true frame average
            total_gap_ = 0.0;
            gap_samples_ = 0;
        }
    }
    
    std::unordered_set<uint64_t> evaluated_pairs;
    // Single-threaded narrow phase collision detection
    for (size_t i = 0; i < state_write_.size(); ++i) {
        auto& agent = state_write_[i];
        if (agent.hull_size < 3) continue; // skip pedestrians
        for (int n_idx : agent.neighbor_indices) {
            if (n_idx == (int)i) continue;
            auto& neighbor = state_write_[n_idx];
            if (neighbor.hull_size < 3) continue;

            uint64_t key = ((uint64_t)std::min((int)i, n_idx) << 32) | (uint64_t)std::max((int)i, n_idx);
            if (!evaluated_pairs.insert(key).second) continue;

            CollisionResult res = check_sat(agent.hull.data(), agent.hull_size, neighbor.hull.data(), neighbor.hull_size);
            if (res.colliding) {
                Vec2 sep = res.normal * (res.penetration_depth * 0.5 + 0.01);
                agent.position = agent.position - sep;
                neighbor.position = neighbor.position + sep;
                agent.speed *= 0.8;
                neighbor.speed *= 0.8;
                compute_hull(agent, config_);
                compute_hull(neighbor, config_);
            }
        }
    }

    // Vehicle-pedestrian checks (D4)
    for (size_t i = 0; i < state_write_.size(); ++i) {
        auto& agent = state_write_[i];
        if (agent.hull_size == 0) continue;  // skip pedestrians as ego
        
        // Barricade checks
        if (config_.enable_barricades) {
            for (const auto& barricade : obstacles_.barricades) {
                CollisionResult res = check_sat(agent.hull.data(), agent.hull_size, 
                                                 barricade.hull.data(), barricade.hull.size());
                if (res.colliding) {
                    agent.position = agent.position - res.normal * (res.penetration_depth + 0.02);
                    agent.speed *= 0.3;
                    compute_hull(agent, config_);
                }
            }
        }
        
        for (int n_idx : agent.neighbor_indices) {
            auto& neighbor = state_write_[n_idx];
            if (neighbor.hull_size != 0) continue;  // only check vs pedestrians
            double ped_radius = get_agent_profile(neighbor.type).width / 2.0;
            auto res = check_circle_polygon(neighbor.position, ped_radius, agent.hull.data(), agent.hull_size);
            if (res.colliding) {
                neighbor.position = neighbor.position + res.normal * (res.penetration_depth + 0.05);
                agent.speed *= 0.5;
            }
        }
    }

    std::swap(state_read_, state_write_);
    sim_time_ += config_.dt;
    tick_count_++;
}

void Engine::broadcast_state() {
    ws_server_.broadcast(state_read_);
}
