#ifndef NETWORK_NETTYPES_H
#define NETWORK_NETTYPES_H

#include <string>
#include <vector>
#include <unordered_map>
#include "../math/Vec2.h"

struct NetEdge {
    std::string id;
    std::string from_junction;
    std::string to_junction;
    int num_lanes = 0;
    double speed_limit = 13.89;
    double width = 3.2;
    std::vector<std::vector<Vec2>> lane_shapes;
};

struct NetJunction {
    std::string id;
    Vec2 position;
    std::string type;
    std::vector<std::string> incoming_edges;
    std::vector<std::string> outgoing_edges;
    std::vector<Vec2> shape;
};

struct NetMap {
    std::unordered_map<std::string, NetEdge> edges;
    std::unordered_map<std::string, NetJunction> junctions;
};

#endif
