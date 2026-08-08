#ifndef COLLISION_SAT_H
#define COLLISION_SAT_H

#include "../math/Vec2.h"
#include <vector>

struct CollisionResult {
    bool colliding = false;
    double penetration_depth = 0.0;
    Vec2 normal; 
};

CollisionResult check_sat(const Vec2* hull_a, int size_a, const Vec2* hull_b, int size_b);
CollisionResult check_circle_polygon(Vec2 center, double radius, const Vec2* hull, int hull_size);

#endif
