#ifndef CORE_SIMCONFIG_H
#define CORE_SIMCONFIG_H

#include <string>
#include <vector>

struct SimConfig {
    double dt = 0.02;
    int target_fps = 50;
    int num_agents = 200;
    double world_width = 1000.0;
    double world_height = 1000.0;
    int K_neighbors = 16;
    double grid_cell_size = 10.0;
    double max_step_ms = 12.0;
    double idm_s0 = 2.0;
    double idm_T = 1.5;
    double idm_a = 2.5;
    double idm_b = 4.0;
    double idm_delta = 4.0;
    double sfm_A = 5.0;
    double sfm_B = 0.3;
    double sfm_goal_weight = 1.0;
    double sfm_asymmetric_weight = 0.5;
    double sfm_tau = 0.5;
    double fsm_squeeze_speed_factor = 0.7;
    double fsm_yield_distance = 15.0;
    double fsm_turn_max_speed = 5.0;
    int min_route_segments = 5;
    std::vector<double> vehicle_distribution = {0.40, 0.15, 0.35, 0.10};
    std::string net_xml_path = "";
    std::string obstacles_json_path = "";
    int ws_port = 9001;
    bool enable_barricades = true;
    bool enable_potholes = true;
    bool headless = false;
    double duration = -1.0;
    std::string schedule_json_path = "";
    double comf_decel = -1.0; // Overrides profile if > 0
    double car_width = -1.0; // Overrides CAR profile if > 0
    double car_length = -1.0; // Overrides CAR profile if > 0
    double route_logit_theta = 0.15; // Logit scale parameter
    double route_density_lambda = 0.0; // Density penalty weight
    double lateral_spread_sigma = 0.4; // Lateral spread noise magnitude
};

SimConfig load_config(const std::string& path);

#endif
