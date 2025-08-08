import { useState, useEffect } from 'react';
import API_ENDPOINTS from '../config/api';

interface ProgressData {
  log_date: string;
  total_tasks: number;
  completed_tasks: number;
  completion_rate: number;
}

interface GoalAnalytics {
  id: number;
  title: string;
  category: string;
  total_logs: number;
  completed_logs: number;
  completion_rate: number;
  streak: number;
}

export function useAnalytics(days: number = 30) {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [goalStats, setGoalStats] = useState<GoalAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch progress data
      const progressResponse = await fetch(`${API_ENDPOINTS.ANALYTICS_PROGRESS}?days=${days}`);
      if (!progressResponse.ok) {
        throw new Error('Failed to fetch progress data');
      }
      const progressResult = await progressResponse.json();
      setProgressData(progressResult.progress);

      // Fetch goal analytics
      const goalsResponse = await fetch(API_ENDPOINTS.ANALYTICS_GOALS);
      if (!goalsResponse.ok) {
        throw new Error('Failed to fetch goal statistics');
      }
      const goalsResult = await goalsResponse.json();
      setGoalStats(goalsResult.goalStats);

      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch analytics';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [days]);

  return {
    progressData,
    goalStats,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}
