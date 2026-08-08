#ifndef OBSTACLES_H
#define OBSTACLES_H

#include "../math/Vec2.h"
#include "../network/RoadGraph.h"
#include <vector>
#include <string>
#include <random>

struct Barricade {
    std::string id;
    std::vector<Vec2> hull;  // convex polygon vertices (CCW winding)
    Vec2 center;             // precomputed centroid
};

struct Pothole {
    std::string id;
    Vec2 center;
    double radius;           // affected zone radius (meters)
    double severity;         // 0.0–1.0, where 1.0 = impassable, 0.5 = halved accel/decel
};

struct ObstacleSet {
    std::vector<Barricade> barricades;
    std::vector<Pothole> potholes;

    void load_from_json(const std::string& filepath);
    void generate_random(const RoadGraph& graph, int num_barricades, int num_potholes, std::mt19937& rng);
};

#endif
