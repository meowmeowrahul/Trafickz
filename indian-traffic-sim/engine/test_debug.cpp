#include <iostream>
#include <cmath>

int main() {
    struct Vec2 {
        double x, y;
        Vec2(double x, double y) : x(x), y(y) {}
        double dot(const Vec2& o) const { return x*o.x + y*o.y; }
        Vec2 perpendicular() const { return Vec2(-y, x); }
        double length() const { return std::sqrt(x*x + y*y); }
        Vec2 operator-(const Vec2& o) const { return Vec2(x-o.x, y-o.y); }
    };
    
    Vec2 ego_pos = {0,0};
    double heading = 0.0;
    Vec2 forward(std::cos(heading), std::sin(heading));
    // Vec2 right = forward.perpendicular();
    // In actual Vec2.h:
    Vec2 right(-forward.y, forward.x);
    
    Vec2 n_pos = {5, -1.0};
    Vec2 to_n = n_pos - ego_pos;
    
    double lon = forward.dot(to_n);
    double lat = right.dot(to_n);
    
    std::cout << "lon: " << lon << " lat: " << lat << "\n";
    
    bool gap_left = true;
    double width = 1.8;
    if (lon > -2.0 && lon < 8.0) {
        if (lat < -0.5 && lat > -(width + 1.5)) gap_left = false;
    }
    
    std::cout << "gap_left: " << gap_left << "\n";
}
