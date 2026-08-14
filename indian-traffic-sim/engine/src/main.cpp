#include <iostream>
#include <csignal>
#include "core/Engine.h"

Engine* g_engine = nullptr;

void signal_handler(int) {
    if (g_engine) {
        std::cout << "\n[Main] Stopping engine...\n";
        g_engine->stop();
    }
}

int main(int argc, char* argv[]) {
    std::signal(SIGINT, signal_handler);
    std::signal(SIGTERM, signal_handler);

    std::string config_path = "../config/config.default.json";
    
    bool headless = false;
    double duration = -1.0;
    double idm_T = -1.0;
    double idm_s0 = -1.0;
    double sfm_A = -1.0;
    double sfm_B = -1.0;
    double comf_decel = -1.0;
    int num_agents = -1;
    double car_width = -1.0;
    double car_length = -1.0;
    std::string schedule_path = "";
    std::string net_xml_path_arg = "";

    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--headless") headless = true;
        else if (arg == "--duration" && i + 1 < argc) duration = std::stod(argv[++i]);
        else if (arg == "--num_agents" && i + 1 < argc) num_agents = std::stoi(argv[++i]);
        else if (arg == "--idm_T" && i + 1 < argc) idm_T = std::stod(argv[++i]);
        else if (arg == "--idm_s0" && i + 1 < argc) idm_s0 = std::stod(argv[++i]);
        else if (arg == "--sfm_A" && i + 1 < argc) sfm_A = std::stod(argv[++i]);
        else if (arg == "--sfm_B" && i + 1 < argc) sfm_B = std::stod(argv[++i]);
        else if (arg == "--comf_decel" && i + 1 < argc) comf_decel = std::stod(argv[++i]);
        else if (arg == "--car_width" && i + 1 < argc) car_width = std::stod(argv[++i]);
        else if (arg == "--car_length" && i + 1 < argc) car_length = std::stod(argv[++i]);
        else if (arg == "--schedule" && i + 1 < argc) schedule_path = argv[++i];
        else if (arg == "--net_xml" && i + 1 < argc) net_xml_path_arg = argv[++i];
        else if (arg[0] != '-') config_path = arg;
    }

    SimConfig config = load_config(config_path);
    config.headless = headless;
    if (duration > 0) config.duration = duration;
    if (num_agents > 0) config.num_agents = num_agents;
    if (idm_T > 0) config.idm_T = idm_T;
    if (idm_s0 > 0) config.idm_s0 = idm_s0;
    if (sfm_A > 0) config.sfm_A = sfm_A;
    if (sfm_B > 0) config.sfm_B = sfm_B;
    if (comf_decel > 0) config.comf_decel = comf_decel;
    if (car_width > 0) config.car_width = car_width;
    if (car_length > 0) config.car_length = car_length;
    if (!schedule_path.empty()) config.schedule_json_path = schedule_path;
    
    // Allow overriding or explicitly clearing the net_xml_path
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == "--net_xml" && i + 1 < argc) {
            config.net_xml_path = argv[i+1];
        }
    }

    if (config.headless) {
        std::cout << "[Main] Headless Mode Enabled. Target duration: " << config.duration << "s\n";
    } else {
        std::cout << "╔══════════════════════════════════════╗\n"
                  << "║  Indian Traffic Simulation Engine    ║\n"
                  << "║  v1.5 — Phase 1                      ║\n"
                  << "╚══════════════════════════════════════╝\n";
    }

    Engine engine(config);
    g_engine = &engine;
    engine.run();

    return 0;
}
