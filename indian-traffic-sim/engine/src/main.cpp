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
    if (argc > 1) {
        config_path = argv[1];
    }

    SimConfig config = load_config(config_path);
    
    std::cout << "╔══════════════════════════════════════╗\n"
              << "║  Indian Traffic Simulation Engine    ║\n"
              << "║  v1.5 — Phase 1                      ║\n"
              << "╚══════════════════════════════════════╝\n";

    Engine engine(config);
    g_engine = &engine;
    engine.run();

    return 0;
}
