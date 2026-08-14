#include "RoadGraph.h"
#include <iostream>
#include <queue>
#include <limits>
#include <algorithm>

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
    
    auto add_segment = [&](const std::string& id, Vec2 start, Vec2 end, std::vector<int> outs) {
        RoadSegment seg;
        seg.edge_id = id;
        seg.width = 15.0;
        seg.speed_limit = 20.0;
        seg.centerline = {start, end};
        seg.length = (end - start).length();
        seg.outgoing_segment_indices = outs;
        edge_id_to_segment[id] = segments.size();
        segments.push_back(seg);
    };

    // Single 5000m straight road for dense flow calibration
    add_segment("straight_calibration", {0, 0}, {5000, 0}, {});

    std::cout << "[RoadGraph] Test loop generated with " << segments.size() << " segments.\n";
}

std::vector<int> RoadGraph::get_shortest_path(int start_segment, int end_segment) const {
    if (start_segment < 0 || start_segment >= (int)segments.size() || 
        end_segment < 0 || end_segment >= (int)segments.size()) {
        return {};
    }

    std::vector<double> dist(segments.size(), std::numeric_limits<double>::infinity());
    std::vector<int> prev(segments.size(), -1);
    
    using P = std::pair<double, int>;
    std::priority_queue<P, std::vector<P>, std::greater<P>> pq;

    dist[start_segment] = 0.0;
    pq.push({0.0, start_segment});

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();

        if (d > dist[u]) continue;
        if (u == end_segment) break;

        for (int v : segments[u].outgoing_segment_indices) {
            double weight = segments[v].length;
            if (dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
                prev[v] = u;
                pq.push({dist[v], v});
            }
        }
    }

    if (dist[end_segment] == std::numeric_limits<double>::infinity()) {
        return {};
    }

    std::vector<int> path;
    for (int at = end_segment; at != -1; at = prev[at]) {
        path.push_back(at);
    }
    std::reverse(path.begin(), path.end());
    return path;
}

int RoadGraph::get_nearest_segment(const Vec2& point) const {
    int best_idx = 0;
    double min_dist = 1e9;
    for (size_t i = 0; i < segments.size(); ++i) {
        const auto& seg = segments[i];
        if (seg.centerline.empty()) continue;
        // Check distance to all segments in the centerline and find min
        for (size_t j = 0; j < seg.centerline.size() - 1; ++j) {
            Vec2 p1 = seg.centerline[j];
            Vec2 p2 = seg.centerline[j+1];
            Vec2 v = p2 - p1;
            Vec2 w = point - p1;
            double c1 = w.dot(v);
            double c2 = v.dot(v);
            double dist = 0.0;
            if (c1 <= 0) dist = (point - p1).length();
            else if (c2 <= c1) dist = (point - p2).length();
            else {
                double b = c1 / c2;
                Vec2 pb = p1 + v * b;
                dist = (point - pb).length();
            }
            if (dist < min_dist) {
                min_dist = dist;
                best_idx = i;
            }
        }
    }
    return best_idx;
}
