from typing import List, Optional
from backend.app.models.agent import Agent

class WeightedRoundRobinRouter:
    """
    Stateful Weighted Round Robin Selector.
    
    Given a list of eligible agents, selects the next agent based on their weights
    using a stateful pointer (index and current weight credit) stored in Redis/cache.
    """
    
    @staticmethod
    def select_agent(
        eligible_agents: List[Agent], 
        last_index: int, 
        current_weight_credit: int
    ) -> tuple[Optional[Agent], int, int]:
        """
        Runs the Weighted Round Robin selection step.
        
        Args:
            eligible_agents: List of Agent models currently eligible for routing.
            last_index: The index of the agent selected in the previous routing run.
            current_weight_credit: The remaining weight credit of the active agent pointer.
            
        Returns:
            Tuple of (Selected Agent, updated_last_index, updated_current_weight_credit)
        """
        if not eligible_agents:
            return None, 0, 0

        # Sort agents deterministically by ID to ensure index consistency across threads
        sorted_agents = sorted(eligible_agents, key=lambda a: a.id)
        num_agents = len(sorted_agents)

        # Handle out of bounds index (e.g., if eligible agents count changed)
        if last_index >= num_agents or last_index < 0:
            last_index = 0
            current_weight_credit = sorted_agents[0].weight

        # Try to select the agent at the current index if they have credit
        for _ in range(num_agents * 2):  # Limit loop to prevent infinite runs
            agent = sorted_agents[last_index]
            
            if current_weight_credit > 0:
                # Deduct 1 credit for the assignment
                new_credit = current_weight_credit - 1
                return agent, last_index, new_credit
            
            # If no credit left, advance to the next agent
            last_index = (last_index + 1) % num_agents
            current_weight_credit = sorted_agents[last_index].weight
            
        # Fallback to direct first agent if loop exhausts
        fallback_agent = sorted_agents[0]
        return fallback_agent, 0, max(0, fallback_agent.weight - 1)
