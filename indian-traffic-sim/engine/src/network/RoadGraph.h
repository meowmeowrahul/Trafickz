#ifndef NETWORK_ROADGRAPH_H
#define NETWORK_ROADGRAPH_H

#include <string>
#include <vector>
#include <unordered_map>
#include <random>
#include "../math/Vec2.h"
#include "NetTypes.h"

struct RoadSegment {
    std::string edge_id;
    std::vector<Vec2> centerline;
    double width;
    double speed_limit;
    double length;
    std::string from_junction_id;
    std::string to_junction_id;
    std::vector<int> outgoing_segment_indices;
    bool is_internal = false;  // NEW: true for junction connector segments
};

class RoadGraph {
public:
    std::vector<RoadSegment> segments;
    std::unordered_map<std::string, int> edge_id_to_segment;
    
    void build_from_net_map(const NetMap& net_map);
    std::vector<int> get_random_route(int start_segment, int min_segments, std::mt19937& rng) const;
    std::vector<int> get_shortest_path(int start_segment, int end_segment, int agent_id = 0, double theta = 0.0, const std::vector<int>* segment_occupancy = nullptr, double density_lambda = 0.0) const;
    int get_nearest_segment(const Vec2& point) const;
    void generate_test_grid(double size, int roads_per_side);
};

#endif
