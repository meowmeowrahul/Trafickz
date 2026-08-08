#include "SimConfig.h"
#include <fstream>
#include <iostream>
#include <nlohmann/json.hpp>

SimConfig load_config(const std::string& path) {
    SimConfig cfg;
    std::ifstream ifs(path);
    if (!ifs.is_open()) {
        std::cerr << "Could not open config file: " << path << ", using defaults.\n";
        return cfg;
    }
    nlohmann::json j;
    try {
        ifs >> j;
    } catch (const nlohmann::json::exception& e) {
        std::cerr << "Config JSON parse error: " << e.what() << "\n";
        return cfg;
    }
    
    if (j.contains("dt")) cfg.dt = j["dt"];
    if (j.contains("target_fps")) cfg.target_fps = j["target_fps"];
    if (j.contains("num_agents")) cfg.num_agents = j["num_agents"];
    if (j.contains("world_width")) cfg.world_width = j["world_width"];
    if (j.contains("world_height")) cfg.world_height = j["world_height"];
    if (j.contains("K_neighbors")) cfg.K_neighbors = j["K_neighbors"];
    if (j.contains("grid_cell_size")) cfg.grid_cell_size = j["grid_cell_size"];
    if (j.contains("max_step_ms")) cfg.max_step_ms = j["max_step_ms"];
    if (j.contains("idm_s0")) cfg.idm_s0 = j["idm_s0"];
    if (j.contains("idm_T")) cfg.idm_T = j["idm_T"];
    if (j.contains("idm_a")) cfg.idm_a = j["idm_a"];
    if (j.contains("idm_b")) cfg.idm_b = j["idm_b"];
    if (j.contains("idm_delta")) cfg.idm_delta = j["idm_delta"];
    if (j.contains("sfm_A")) cfg.sfm_A = j["sfm_A"];
    if (j.contains("sfm_B")) cfg.sfm_B = j["sfm_B"];
    if (j.contains("sfm_goal_weight")) cfg.sfm_goal_weight = j["sfm_goal_weight"];
    if (j.contains("sfm_asymmetric_weight")) cfg.sfm_asymmetric_weight = j["sfm_asymmetric_weight"];
    if (j.contains("sfm_tau")) cfg.sfm_tau = j["sfm_tau"];
    if (j.contains("fsm_squeeze_speed_factor")) cfg.fsm_squeeze_speed_factor = j["fsm_squeeze_speed_factor"];
    if (j.contains("fsm_yield_distance")) cfg.fsm_yield_distance = j["fsm_yield_distance"];
    if (j.contains("fsm_turn_max_speed")) cfg.fsm_turn_max_speed = j["fsm_turn_max_speed"];
    if (j.contains("min_route_segments")) cfg.min_route_segments = j["min_route_segments"];
    if (j.contains("vehicle_distribution")) cfg.vehicle_distribution = j["vehicle_distribution"].get<std::vector<double>>();
    if (j.contains("net_xml_path")) cfg.net_xml_path = j["net_xml_path"];
    if (j.contains("obstacles_json_path")) cfg.obstacles_json_path = j["obstacles_json_path"];
    if (j.contains("ws_port")) cfg.ws_port = j["ws_port"];
    
    return cfg;
}
