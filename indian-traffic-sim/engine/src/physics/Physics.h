#ifndef PHYSICS_PHYSICS_H
#define PHYSICS_PHYSICS_H

#include <vector>
#include "../core/AgentTypes.h"
#include "../core/SimConfig.h"
#include "../network/RoadGraph.h"

void update_physics(const std::vector<AgentState>& read_state,
                    std::vector<AgentState>& write_state,
                    const SimConfig& config,
                    const RoadGraph& graph);

#endif
