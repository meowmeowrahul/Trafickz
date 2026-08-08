#ifndef NETWORK_SPATIALHASH_H
#define NETWORK_SPATIALHASH_H

#include <vector>
#include <unordered_map>
#include "../math/Vec2.h"
#include "../core/AgentTypes.h"

class SpatialHash {
public:
    SpatialHash(double cell_size, int max_neighbors);
    void clear();
    void insert(int agent_index, const Vec2& position);
    std::vector<int> query_neighbors(const Vec2& position, int self_index, const std::vector<AgentState>& agents) const;
private:
    double cell_size_;
    int max_neighbors_;
    std::unordered_map<uint64_t, std::vector<int>> grid_;
    
    uint64_t hash(int cx, int cy) const {
        uint32_t ux = static_cast<uint32_t>(cx);
        uint32_t uy = static_cast<uint32_t>(cy);
        return (static_cast<uint64_t>(ux)) ^ (static_cast<uint64_t>(uy) << 32); 
    }
};

#endif
