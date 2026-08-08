#include "Obstacles.h"
#include <fstream>
#include <iostream>
#include <nlohmann/json.hpp>
#include <algorithm>

using json = nlohmann::json;

void ObstacleSet::load_from_json(const std::string& filepath) {
    std::ifstream f(filepath);
    if (!f.is_open()) {
        std::cerr << "[Obstacles] Failed to open " << filepath << std::endl;
        return;
    }
    
    json j;
    try {
        f >> j;
    } catch (const std::exception& e) {
        std::cerr << "[Obstacles] JSON parse error: " << e.what() << std::endl;
        return;
    }
    
    if (j.contains("barricades")) {
        for (const auto& j_b : j["barricades"]) {
            Barricade b;
            b.id = j_b["id"];
            Vec2 center(0,0);
            for (const auto& pt : j_b["hull"]) {
                Vec2 v(pt[0].get<double>(), pt[1].get<double>());
                b.hull.push_back(v);
                center = center + v;
            }
            if (!b.hull.empty()) {
                b.center = center * (1.0 / b.hull.size());
            }
            barricades.push_back(b);
        }
    }
    
    if (j.contains("potholes")) {
        for (const auto& j_p : j["potholes"]) {
            Pothole p;
            p.id = j_p["id"];
            p.center = Vec2(j_p["center"][0].get<double>(), j_p["center"][1].get<double>());
            p.radius = j_p["radius"].get<double>();
            p.severity = std::clamp(j_p["severity"].get<double>(), 0.0, 0.9);
            potholes.push_back(p);
        }
    }
    
    std::cout << "[Obstacles] Loaded " << barricades.size() << " barricades and " 
              << potholes.size() << " potholes from " << filepath << "\n";
}

void ObstacleSet::generate_random(const RoadGraph& graph, int num_barricades, int num_potholes, std::mt19937& rng) {
    if (graph.segments.empty()) return;
    
    std::uniform_int_distribution<int> dist_seg(0, graph.segments.size() - 1);
    std::uniform_real_distribution<double> dist_t(0.1, 0.9);
    
    // Generate Barricades
    for (int i = 0; i < num_barricades; ++i) {
        int seg_idx = dist_seg(rng);
        const auto& seg = graph.segments[seg_idx];
        if (seg.centerline.size() < 2) continue;
        
        int wpt_idx = std::uniform_int_distribution<int>(0, seg.centerline.size() - 2)(rng);
        Vec2 p1 = seg.centerline[wpt_idx];
        Vec2 p2 = seg.centerline[wpt_idx + 1];
        Vec2 dir = (p2 - p1).normalized();
        Vec2 right = dir.perpendicular();
        Vec2 center = p1 + dir * (p2 - p1).length() * dist_t(rng);
        
        Barricade b;
        b.id = "b_rand_" + std::to_string(i);
        b.center = center;
        
        // 2m x 0.5m rectangle perpendicular to road
        double hl = 0.25;
        double hw = 1.0;
        
        b.hull.push_back(center + dir * hl + right * hw);
        b.hull.push_back(center + dir * hl - right * hw);
        b.hull.push_back(center - dir * hl - right * hw);
        b.hull.push_back(center - dir * hl + right * hw);
        
        barricades.push_back(b);
    }
    
    // Generate Potholes
    std::uniform_real_distribution<double> dist_r(1.0, 3.0);
    std::uniform_real_distribution<double> dist_s(0.3, 0.8);
    for (int i = 0; i < num_potholes; ++i) {
        int seg_idx = dist_seg(rng);
        const auto& seg = graph.segments[seg_idx];
        if (seg.centerline.size() < 2) continue;
        
        int wpt_idx = std::uniform_int_distribution<int>(0, seg.centerline.size() - 2)(rng);
        Vec2 p1 = seg.centerline[wpt_idx];
        Vec2 p2 = seg.centerline[wpt_idx + 1];
        Vec2 center = p1 + (p2 - p1) * dist_t(rng);
        
        Pothole p;
        p.id = "p_rand_" + std::to_string(i);
        p.center = center;
        p.radius = dist_r(rng);
        p.severity = dist_s(rng);
        
        potholes.push_back(p);
    }
    
    std::cout << "[Obstacles] Generated " << barricades.size() << " random barricades and " 
              << potholes.size() << " random potholes.\n";
}
