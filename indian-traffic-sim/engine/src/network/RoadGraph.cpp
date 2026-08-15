#include "RoadGraph.h"
#include <iostream>
#include <queue>
#include <limits>
#include <algorithm>
#include <chrono>
#include <atomic>
#include <random>

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
        seg.is_internal = edge.is_internal;
        seg.width = edge.width * (edge.is_internal ? 1 : edge.num_lanes);
        seg.speed_limit = edge.speed_limit;
        seg.from_junction_id = edge.from_junction;
        seg.to_junction_id = edge.to_junction;
        
        if (!edge.lane_shapes.empty() && !edge.lane_shapes[0].empty()) {
            const auto& first_lane = edge.lane_shapes.front();
            const auto& last_lane = edge.lane_shapes.back();
            std::vector<Vec2> center;
            size_t pts = std::min(first_lane.size(), last_lane.size());
            for (size_t i = 0; i < pts; ++i) {
                center.push_back({(first_lane[i].x + last_lane[i].x) * 0.5, (first_lane[i].y + last_lane[i].y) * 0.5});
            }
            if (pts == 0) center = first_lane;
            seg.centerline = center; 
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
    
    // Second pass: wire connectivity using connections
    for (const auto& conn : net_map.connections) {
        std::string via_edge_id;
        if (!conn.via.empty()) {
            size_t last_us = conn.via.rfind('_');
            if (last_us != std::string::npos) {
                via_edge_id = conn.via.substr(0, last_us);
            }
        }

        auto from_it = edge_id_to_segment.find(conn.from_edge);
        auto to_it = edge_id_to_segment.find(conn.to_edge);
        auto via_it = edge_id_to_segment.find(via_edge_id);

        if (from_it != edge_id_to_segment.end() && to_it != edge_id_to_segment.end()) {
            if (via_it != edge_id_to_segment.end()) {
                // Wire: from_edge -> internal_edge -> to_edge
                auto& from_seg = segments[from_it->second];
                auto& via_seg = segments[via_it->second];

                if (std::find(from_seg.outgoing_segment_indices.begin(),
                              from_seg.outgoing_segment_indices.end(),
                              via_it->second) == from_seg.outgoing_segment_indices.end()) {
                    from_seg.outgoing_segment_indices.push_back(via_it->second);
                }

                if (std::find(via_seg.outgoing_segment_indices.begin(),
                              via_seg.outgoing_segment_indices.end(),
                              to_it->second) == via_seg.outgoing_segment_indices.end()) {
                    via_seg.outgoing_segment_indices.push_back(to_it->second);
                }
            } else {
                // No internal edge found — fall back to direct connection
                auto& from_seg = segments[from_it->second];
                if (std::find(from_seg.outgoing_segment_indices.begin(),
                              from_seg.outgoing_segment_indices.end(),
                              to_it->second) == from_seg.outgoing_segment_indices.end()) {
                    from_seg.outgoing_segment_indices.push_back(to_it->second);
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
        seg.width = 40.0; // Widen from 8.0 to 40.0 to easily fit the 28m dataset spread          
        seg.speed_limit = 15.0;
        seg.centerline = {start, end};
        seg.length = (end - start).length();
        seg.outgoing_segment_indices = outs;
        edge_id_to_segment[id] = segments.size();
        segments.push_back(seg);
    };

    // Forward lane (Right-to-Left). Centered at Y=0 so width 40 covers Y=-20 to Y=+20.           
    add_segment("corridor_fwd", {200, 0}, {-100, 0}, {1});                                        
    // Return lane (Left-to-Right). Move it far away (Y=50) so it doesn't overlap.                
    add_segment("corridor_ret", {-100, 50}, {200, 50}, {0});

    std::cout << "[RoadGraph] Test loop generated with " << segments.size() << " segments.\n";
}

static double sample_gumbel(double theta, std::mt19937& rng) {
    if (theta <= 1e-6) return 0.0;
    std::uniform_real_distribution<double> u(1e-10, 1.0);
    return -theta * std::log(-std::log(u(rng)));
}

std::vector<int> RoadGraph::get_shortest_path(int start_segment, int end_segment, int agent_id, double theta, const std::vector<int>* segment_occupancy, double density_lambda) const {
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

    // Deterministic, thread-safe, and unique per path-request
    uint64_t seed = (uint64_t)agent_id * 2654435761ULL;
    seed ^= (uint64_t)start_segment * 14695981039346656037ULL;
    seed ^= (uint64_t)end_segment * 1099511628211ULL;
    std::mt19937 local_rng(seed);
    
    std::vector<double> gumbel_noise(segments.size());
    for (size_t i = 0; i < segments.size(); ++i) {
        gumbel_noise[i] = sample_gumbel(theta, local_rng);
    }

    while (!pq.empty()) {
        auto [d, u] = pq.top();
        pq.pop();

        if (d > dist[u]) continue;
        if (u == end_segment) break;

        for (int v : segments[u].outgoing_segment_indices) {
            double occupancy_penalty = 0.0;
            if (segment_occupancy && v < (int)segment_occupancy->size()) {
                occupancy_penalty = density_lambda * (*segment_occupancy)[v];
            }
            double weight = segments[v].length + gumbel_noise[v] + occupancy_penalty;
            weight = std::max(0.1, weight); // Prevent negative edge weights
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
