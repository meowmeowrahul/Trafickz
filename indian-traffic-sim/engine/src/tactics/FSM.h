#ifndef TACTICS_FSM_H
#define TACTICS_FSM_H

#include "../core/AgentTypes.h"
#include "../core/SimConfig.h"
#include <vector>

void update_tactical_state(AgentState& ego, const std::vector<AgentState>& neighbors, const SimConfig& config);

#endif
