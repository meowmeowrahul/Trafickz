#include "SAT.h"
#include <cmath>
#include <algorithm>
#include <limits>

CollisionResult check_sat(const Vec2* hull_a, int size_a, const Vec2* hull_b, int size_b) {
    CollisionResult result;
    result.colliding = true;
    result.penetration_depth = std::numeric_limits<double>::max();

    const Vec2* hulls[2] = {hull_a, hull_b};
    int sizes[2] = {size_a, size_b};

    for (int i = 0; i < 2; ++i) {
        const Vec2* poly = hulls[i];
        int size = sizes[i];
        for (int j = 0; j < size; ++j) {
            Vec2 p1 = poly[j];
            Vec2 p2 = poly[(j + 1) % size];
            Vec2 edge = p2 - p1;
            Vec2 normal = edge.perpendicular().normalized();

            double min_a = std::numeric_limits<double>::max(), max_a = -std::numeric_limits<double>::max();
            for (int k = 0; k < size_a; ++k) {
                double proj = hull_a[k].dot(normal);
                min_a = std::min(min_a, proj);
                max_a = std::max(max_a, proj);
            }

            double min_b = std::numeric_limits<double>::max(), max_b = -std::numeric_limits<double>::max();
            for (int k = 0; k < size_b; ++k) {
                double proj = hull_b[k].dot(normal);
                min_b = std::min(min_b, proj);
                max_b = std::max(max_b, proj);
            }

            if (max_a <= min_b || max_b <= min_a) {
                result.colliding = false;
                return result;
            }

            double overlap = std::min(max_a, max_b) - std::max(min_a, min_b);
            if (overlap < result.penetration_depth) {
                result.penetration_depth = overlap;
                result.normal = normal;
                Vec2 center_a(0,0), center_b(0,0);
                for(int k=0; k<size_a; ++k) center_a = center_a + hull_a[k];
                for(int k=0; k<size_b; ++k) center_b = center_b + hull_b[k];
                center_a = center_a * (1.0 / size_a);
                center_b = center_b * (1.0 / size_b);
                if ((center_b - center_a).dot(result.normal) < 0) {
                    result.normal = result.normal * -1.0;
                }
            }
        }
    }
    return result;
}

CollisionResult check_circle_polygon(Vec2 center, double radius, const Vec2* hull, int hull_size) {
    CollisionResult result;
    result.colliding = false;
    
    double min_dist_sq = std::numeric_limits<double>::max();
    Vec2 closest_point;
    
    for (int i = 0; i < hull_size; ++i) {
        Vec2 a = hull[i];
        Vec2 b = hull[(i + 1) % hull_size];
        Vec2 edge = b - a;
        double t = std::clamp((center - a).dot(edge) / edge.length_sq(), 0.0, 1.0);
        Vec2 proj = a + edge * t;
        double d_sq = Vec2::distance_sq(center, proj);
        if (d_sq < min_dist_sq) {
            min_dist_sq = d_sq;
            closest_point = proj;
        }
    }
    
    double dist = std::sqrt(min_dist_sq);
    if (dist < radius) {
        result.colliding = true;
        result.penetration_depth = radius - dist;
        result.normal = (center - closest_point).normalized();
        if (result.normal.length_sq() < 1e-9) result.normal = {0, 1};
    }
    return result;
}
