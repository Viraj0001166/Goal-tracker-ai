import { useState, useEffect } from 'react';
import { Goal, CreateGoal, UpdateGoal } from '@/shared/types';
import toast from 'react-hot-toast';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/goals');
      if (!response.ok) {
        throw new Error('Failed to fetch goals');
      }
      const data = await response.json();
      setGoals(data.goals);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createGoal = async (goalData: CreateGoal) => {
    try {
      const response = await fetch('/api/goals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create goal');
      }
      
      const data = await response.json();
      setGoals(prev => [data.goal, ...prev]);
      toast.success('Goal created successfully!');
      return data.goal;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create goal';
      toast.error(errorMessage);
      throw err;
    }
  };

  const updateGoal = async (goalData: UpdateGoal) => {
    try {
      const response = await fetch(`/api/goals/${goalData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goalData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update goal');
      }
      
      const data = await response.json();
      setGoals(prev => prev.map(goal => 
        goal.id === goalData.id ? data.goal : goal
      ));
      toast.success('Goal updated successfully!');
      return data.goal;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update goal';
      toast.error(errorMessage);
      throw err;
    }
  };

  const deleteGoal = async (goalId: number) => {
    try {
      const response = await fetch(`/api/goals/${goalId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete goal');
      }
      
      setGoals(prev => prev.filter(goal => goal.id !== goalId));
      toast.success('Goal deleted successfully!');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete goal';
      toast.error(errorMessage);
      throw err;
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  return {
    goals,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    refetch: fetchGoals,
  };
}
