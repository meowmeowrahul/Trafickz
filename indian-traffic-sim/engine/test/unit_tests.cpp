#include <gtest/gtest.h>
#include "../src/math/Vec2.h"
#include "../src/core/AgentTypes.h"
#include "../src/network/SpatialHash.h"
#include "../src/collision/SAT.h"
#include "../src/tactics/FSM.h"
#include "../src/network/RoadGraph.h"
#include "../src/obstacles/Obstacles.h"
#include "../src/physics/Physics.h"
#include "../src/core/SimConfig.h"

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
    // CAR profile: length = 4.5. Center = 0.0
    // hl = 2.25, hw = 0.9
    // front-right = 2.25, 0.9
    EXPECT_NEAR(std::abs(state.hull[0].x), 2.25, 1e-5);
    EXPECT_NEAR(std::abs(state.hull[0].y), 0.9, 1e-5);
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

TEST(SATTest, OverlappingRectangles) {
    Vec2 hull_a[] = {{0,0}, {2,0}, {2,2}, {0,2}};
    Vec2 hull_b[] = {{1.5,0}, {3.5,0}, {3.5,2}, {1.5,2}};
    auto res = check_sat(hull_a, 4, hull_b, 4);
    EXPECT_TRUE(res.colliding);
    EXPECT_NEAR(res.penetration_depth, 0.5, 1e-5);
}

TEST(SATTest, SeparatedRectangles) {
    Vec2 hull_a[] = {{0,0}, {2,0}, {2,2}, {0,2}};
    Vec2 hull_b[] = {{7,0}, {9,0}, {9,2}, {7,2}};
    auto res = check_sat(hull_a, 4, hull_b, 4);
    EXPECT_FALSE(res.colliding);
}

TEST(SATTest, CirclePolygon) {
    Vec2 hull[] = {{-1,-1}, {1,-1}, {1,1}, {-1,1}}; // 2x2 square at origin
    auto res = check_circle_polygon({0, 0.8}, 0.5, hull, 4);
    EXPECT_TRUE(res.colliding);
    EXPECT_NEAR(res.penetration_depth, 0.3, 1e-5);
}

TEST(FSMTest, FreeFlowToEvaluateGap) {
    AgentState ego{};
    ego.tactical_state = TacticalState::FREE_FLOW;
    ego.speed = 5.0;
    ego.position = {0,0};
    ego.heading = 0.0;
    ego.type = AgentType::CAR;

    AgentState neighbor{};
    neighbor.position = {10,0}; // ahead by 10
    neighbor.speed = 1.0; // slow leader

    SimConfig config;
    update_tactical_state(ego, {neighbor}, config);
    EXPECT_EQ(ego.tactical_state, TacticalState::EVALUATE_GAP);
}

TEST(FSMTest, EvaluateGapChecksBothSides) {
    AgentState ego{};
    ego.tactical_state = TacticalState::EVALUATE_GAP;
    ego.speed = 5.0;
    ego.position = {0,0};
    ego.heading = 0.0;
    ego.type = AgentType::CAR; // width 1.8

    AgentState block_left{};
    block_left.position = {5, 1.0}; // blocking left (lat = -1.0)
    
    SimConfig config;
    update_tactical_state(ego, {block_left}, config);
    EXPECT_EQ(ego.tactical_state, TacticalState::SQUEEZE_RIGHT);
}

TEST(RoadGraphTest, RouteGeneration) {
    RoadGraph graph;
    RoadSegment s0; s0.edge_id = "e0"; s0.centerline = {{0,0}, {10,0}};
    RoadSegment s1; s1.edge_id = "e1"; s1.centerline = {{10,0}, {20,0}};
    s0.outgoing_segment_indices.push_back(1);
    graph.segments.push_back(s0);
    graph.segments.push_back(s1);
    
    std::mt19937 rng(42);
    auto route = graph.get_random_route(0, 5, rng);
    EXPECT_FALSE(route.empty());
}

TEST(PhysicsTest, PotholeSpeedReduction) {
    std::vector<AgentState> rs(1), ws(1);
    rs[0].position = {0,0};
    rs[0].speed = 10.0;
    rs[0].type = AgentType::CAR;
    rs[0].tactical_state = TacticalState::FREE_FLOW;
    rs[0].heading = 0.0;
    
    ObstacleSet obs;
    Pothole p;
    p.center = {0,0};
    p.radius = 2.0;
    p.severity = 0.5;
    obs.potholes.push_back(p);
    
    SimConfig config;
    RoadGraph graph;
    
    update_physics(rs, ws, config, graph, obs);
    EXPECT_LT(ws[0].speed, 10.0);
}
