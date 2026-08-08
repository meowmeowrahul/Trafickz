#include "Engine.h"
#include "../parser/NetXmlParser.h"
#include "../physics/Physics.h"
#include "../tactics/FSM.h"
#include "../collision/SAT.h"
#include <chrono>
#include <thread>
#include <iostream>
#include <algorithm>
#include <nlohmann/json.hpp>

Engine::Engine(const SimConfig& config)
    : config_(config),
      spatial_hash_(config.grid_cell_size, config.K_neighbors),
      ws_server_(config.ws_port) {
    if (!config_.net_xml_path.empty()) {
        net_map_ = NetXmlParser::parse(config_.net_xml_path);
    }
    road_graph_.build_from_net_map(net_map_);
    
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
    ws_server_.set_road_json(j_msg.dump());

    ws_server_.set_control_callback([this](int num_agents, double idm_t, double sfm_a) {
        if (num_agents > 0) this->pending_num_agents_ = num_agents;
        if (idm_t > 0) this->pending_idm_T_ = idm_t;
        if (sfm_a > 0) this->pending_sfm_A_ = sfm_a;
    });

    init_agents_on_roads(state_read_, config_.num_agents, road_graph_, rng_);
    state_write_ = state_read_;
}

void Engine::run() {
    running_ = true;
    ws_server_.start();
    std::cout << "[Engine] Started. Agents=" << config_.num_agents 
              << " dt=" << config_.dt << "s port=" << config_.ws_port << "\n";

    auto tick_duration = std::chrono::duration<double>(config_.dt);

    while (running_) {
        auto start_time = std::chrono::steady_clock::now();

        tick();
        broadcast_state();

        auto end_time = std::chrono::steady_clock::now();
        auto elapsed = end_time - start_time;
        double elapsed_ms = std::chrono::duration<double, std::milli>(elapsed).count();
        if (elapsed_ms > config_.max_step_ms) {
            std::cerr << "[Warning] Tick missed budget: " << elapsed_ms << "ms (budget: " << config_.max_step_ms << "ms)\n";
        }
        if (elapsed < tick_duration) {
            std::this_thread::sleep_for(tick_duration - elapsed);
        }
    }
    ws_server_.stop();
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
            init_agents_on_roads(new_agents, to_add, road_graph_, rng_);
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
    
    double p_idm = pending_idm_T_.exchange(-1.0);
    if (p_idm > 0) config_.idm_T = p_idm;
    
    double p_sfm = pending_sfm_A_.exchange(-1.0);
    if (p_sfm > 0) config_.sfm_A = p_sfm;

    spatial_hash_.clear();
    for (size_t i = 0; i < state_read_.size(); ++i) {
        spatial_hash_.insert(i, state_read_[i].position);
    }
    for (size_t i = 0; i < state_read_.size(); ++i) {
        state_read_[i].neighbor_indices = spatial_hash_.query_neighbors(state_read_[i].position, i, state_read_);
    }

    #pragma omp parallel for schedule(static)
    for (size_t i = 0; i < state_read_.size(); ++i) {
        std::vector<AgentState> neighbors;
        for (int idx : state_read_[i].neighbor_indices) {
            neighbors.push_back(state_read_[idx]);
        }
        update_tactical_state(state_read_[i], neighbors, config_);
    }

    update_physics(state_read_, state_write_, config_, road_graph_);
    
    // Single-threaded narrow phase collision detection
    for (size_t i = 0; i < state_write_.size(); ++i) {
        auto& agent = state_write_[i];
        if (agent.hull_size < 3) continue; // skip pedestrians
        for (int n_idx : agent.neighbor_indices) {
            if (n_idx < (int)i) {
                auto& n_list = state_write_[n_idx].neighbor_indices;
                if (std::find(n_list.begin(), n_list.end(), (int)i) != n_list.end()) continue;
            } else if (n_idx == (int)i) continue;
            auto& neighbor = state_write_[n_idx];
            if (neighbor.hull_size < 3) continue;

            CollisionResult res = check_sat(agent.hull.data(), agent.hull_size, neighbor.hull.data(), neighbor.hull_size);
            if (res.colliding) {
                Vec2 sep = res.normal * (res.penetration_depth * 0.5 + 0.01);
                agent.position = agent.position + sep;
                neighbor.position = neighbor.position - sep;
                agent.speed *= 0.8;
                neighbor.speed *= 0.8;
                compute_hull(agent);
                compute_hull(neighbor);
            }
        }
    }

    std::swap(state_read_, state_write_);
    sim_time_ += config_.dt;
}

void Engine::broadcast_state() {
    ws_server_.broadcast(state_read_);
}
