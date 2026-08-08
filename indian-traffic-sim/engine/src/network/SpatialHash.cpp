#include "SpatialHash.h"
#include <cmath>
#include <algorithm>

SpatialHash::SpatialHash(double cell_size, int max_neighbors) 
    : cell_size_(cell_size), max_neighbors_(max_neighbors) {}

void SpatialHash::clear() {
    grid_.clear();
}

void SpatialHash::insert(int agent_index, const Vec2& position) {
    int cx = static_cast<int>(std::floor(position.x / cell_size_));
    int cy = static_cast<int>(std::floor(position.y / cell_size_));
    grid_[hash(cx, cy)].push_back(agent_index);
}

std::vector<int> SpatialHash::query_neighbors(const Vec2& position, int self_index, const std::vector<AgentState>& agents) const {
    int cx = static_cast<int>(std::floor(position.x / cell_size_));
    int cy = static_cast<int>(std::floor(position.y / cell_size_));

    std::vector<int> candidates;
    for (int dx = -1; dx <= 1; ++dx) {
        for (int dy = -1; dy <= 1; ++dy) {
            auto it = grid_.find(hash(cx + dx, cy + dy));
            if (it != grid_.end()) {
                for (int idx : it->second) {
                    if (idx != self_index) {
                        candidates.push_back(idx);
                    }
                }
            }
        }
    }

    if (candidates.size() > static_cast<size_t>(max_neighbors_)) {
        std::sort(candidates.begin(), candidates.end(), [&](int a, int b) {
            return Vec2::distance_sq(position, agents[a].position) < Vec2::distance_sq(position, agents[b].position);
        });
        candidates.resize(max_neighbors_);
    }

    return candidates;
}
