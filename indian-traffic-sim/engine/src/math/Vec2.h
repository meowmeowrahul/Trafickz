#ifndef MATH_VEC2_H
#define MATH_VEC2_H

#include <cmath>

struct alignas(16) Vec2 {
    double x = 0.0;
    double y = 0.0;

    Vec2() = default;
    Vec2(double _x, double _y) : x(_x), y(_y) {}

    Vec2 operator+(const Vec2& o) const { return {x + o.x, y + o.y}; }
    Vec2 operator-(const Vec2& o) const { return {x - o.x, y - o.y}; }
    Vec2 operator*(double s) const { return {x * s, y * s}; }
    Vec2 operator/(double s) const { return {x / s, y / s}; }

    Vec2& operator+=(const Vec2& o) { x += o.x; y += o.y; return *this; }
    Vec2& operator-=(const Vec2& o) { x -= o.x; y -= o.y; return *this; }
    Vec2& operator*=(double s) { x *= s; y *= s; return *this; }
    Vec2& operator/=(double s) { x /= s; y /= s; return *this; }

    double dot(const Vec2& o) const { return x * o.x + y * o.y; }
    double cross(const Vec2& o) const { return x * o.y - y * o.x; }
    double length_sq() const { return x * x + y * y; }
    double length() const { return std::sqrt(length_sq()); }

    Vec2 normalized() const {
        double len = length();
        if (len < 1e-9) return {0.0, 0.0};
        return {x / len, y / len};
    }

    Vec2 perpendicular() const { return {y, -x}; }

    Vec2 rotate(double angle) const {
        double c = std::cos(angle);
        double s = std::sin(angle);
        return {x * c - y * s, x * s + y * c};
    }

    static Vec2 lerp(const Vec2& a, const Vec2& b, double t) {
        return a + (b - a) * t;
    }

    static double distance_sq(const Vec2& a, const Vec2& b) {
        return (a - b).length_sq();
    }

    static double distance(const Vec2& a, const Vec2& b) {
        return (a - b).length();
    }
};

#endif
