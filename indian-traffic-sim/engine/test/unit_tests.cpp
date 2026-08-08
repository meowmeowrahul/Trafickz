#include <gtest/gtest.h>
#include "../src/math/Vec2.h"
#include "../src/core/AgentTypes.h"
#include "../src/network/SpatialHash.h"

TEST(MathTest, Vec2Arithmetic) {
    Vec2 a(1.0, 2.0);
    Vec2 b(3.0, 4.0);
    Vec2 c = a + b;
    EXPECT_DOUBLE_EQ(c.x, 4.0);
    EXPECT_DOUBLE_EQ(c.y, 6.0);
    EXPECT_DOUBLE_EQ(a.dot(b), 11.0);
}

TEST(CoreTest, HullComputation) {
    AgentState state;
    state.type = AgentType::CAR; // 1.8w, 4.5l
    state.position = {0.0, 0.0};
    state.heading = 0.0;
    compute_hull(state);
    
    EXPECT_EQ(state.hull_size, 4);
    // CAR profile: length = 4.5. Center = 0.0 + (2.25)
    // hl = 2.25, hw = 0.9
    // front-right = 2.25 + 2.25, -0.9 => 4.5, -0.9
    EXPECT_NEAR(state.hull[0].x, 4.5, 1e-5);
    EXPECT_NEAR(state.hull[0].y, -0.9, 1e-5);
}

TEST(NetworkTest, SpatialHashNearestNeighbors) {
    SpatialHash hash(10.0, 2);
    std::vector<AgentState> agents(4);
    agents[0].position = {0.0, 0.0};
    agents[1].position = {1.0, 0.0};
    agents[2].position = {5.0, 0.0};
    agents[3].position = {9.0, 0.0};
    
    for(int i=0; i<4; ++i) hash.insert(i, agents[i].position);
    
    auto neighbors = hash.query_neighbors({0.0, 0.0}, 0, agents);
    EXPECT_EQ(neighbors.size(), 2);
    // closest are 1 and 2
    EXPECT_EQ(neighbors[0], 1);
    EXPECT_EQ(neighbors[1], 2);
}
