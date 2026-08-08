#include "RoadGraph.h"
#include <iostream>

void RoadGraph::build_from_net_map(const NetMap& net_map) {
    segments.clear();
    edge_id_to_segment.clear();

    if (net_map.edges.empty()) {
        std::cerr << "[RoadGraph] NetMap is empty, falling back to test grid.\n";
        generate_test_grid(1000.0, 5);
        return;
    }

    for (const auto& [id, edge] : net_map.edges) {
        RoadSegment seg;
        seg.edge_id = id;
        seg.width = edge.width * edge.num_lanes;
        seg.speed_limit = edge.speed_limit;
        seg.from_junction_id = edge.from_junction;
        seg.to_junction_id = edge.to_junction;
        
        if (!edge.lane_shapes.empty() && !edge.lane_shapes[0].empty()) {
            seg.centerline = edge.lane_shapes[0]; 
        } else {
            auto from_it = net_map.junctions.find(seg.from_junction_id);
            auto to_it = net_map.junctions.find(seg.to_junction_id);
            if (from_it != net_map.junctions.end() && to_it != net_map.junctions.end()) {
                seg.centerline = {from_it->second.position, to_it->second.position};
            } else {
                continue;
            }
        }
        
        double len = 0.0;
        for (size_t i = 1; i < seg.centerline.size(); ++i) {
            len += (seg.centerline[i] - seg.centerline[i-1]).length();
        }
        seg.length = len;
        
        edge_id_to_segment[id] = segments.size();
        segments.push_back(seg);
    }
    
    for (auto& seg : segments) {
        auto junc_it = net_map.junctions.find(seg.to_junction_id);
        if (junc_it != net_map.junctions.end()) {
            for (const auto& out_edge_id : junc_it->second.outgoing_edges) {
                auto out_it = edge_id_to_segment.find(out_edge_id);
                if (out_it != edge_id_to_segment.end()) {
                    seg.outgoing_segment_indices.push_back(out_it->second);
                }
            }
        }
    }
    
    std::cout << "[RoadGraph] Built " << segments.size() << " road segments.\n";
}

std::vector<int> RoadGraph::get_random_route(int start_segment, int min_segments, std::mt19937& rng) const {
    std::vector<int> route;
    if (start_segment < 0 || start_segment >= (int)segments.size()) return route;
    
    int current = start_segment;
    route.push_back(current);
    
    while ((int)route.size() < min_segments) {
        const auto& outs = segments[current].outgoing_segment_indices;
        if (outs.empty()) break;
        std::uniform_int_distribution<int> dist(0, outs.size() - 1);
        current = outs[dist(rng)];
        route.push_back(current);
    }
    
    return route;
}

void RoadGraph::generate_test_grid(double size, int roads_per_side) {
    segments.clear();
    edge_id_to_segment.clear();
    
    // Generate a simple continuous square loop instead of a grid
    double half = size * 0.4; // 400m radius
    
    auto add_segment = [&](const std::string& id, Vec2 start, Vec2 end, std::vector<int> outs) {
        RoadSegment seg;
        seg.edge_id = id;
        seg.width = 15.0;
        seg.speed_limit = 13.89;
        seg.centerline = {start, end};
        seg.length = (end - start).length();
        seg.outgoing_segment_indices = outs;
        edge_id_to_segment[id] = segments.size();
        segments.push_back(seg);
    };

    // 0: Top Edge (Left to Right)
    add_segment("top", {-half, half}, {half, half}, {1});
    // 1: Right Edge (Top to Bottom)
    add_segment("right", {half, half}, {half, -half}, {2});
    // 2: Bottom Edge (Right to Left)
    add_segment("bottom", {half, -half}, {-half, -half}, {3});
    // 3: Left Edge (Bottom to Top)
    add_segment("left", {-half, -half}, {-half, half}, {0});

    std::cout << "[RoadGraph] Test loop generated with " << segments.size() << " segments.\n";
}
