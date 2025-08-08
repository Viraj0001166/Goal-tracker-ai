import { useState, useEffect } from 'react';
import { DailyLog } from '@/shared/types';
import API_ENDPOINTS from '../config/api';
import toast from 'react-hot-toast';

export function useDailyLogs(date?: string) {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const url = date ? `${API_ENDPOINTS.DAILY_LOGS}?date=${date}` : API_ENDPOINTS.DAILY_LOGS;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch daily logs');
      }
      const data = await response.json();
      setLogs(data.logs);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateLog = async (logData: Partial<DailyLog>) => {
    try {
      const response = await fetch(API_ENDPOINTS.DAILY_LOGS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save daily log');
      }
      
      const data = await response.json();
      
      // Update or add log in state
      setLogs(prev => {
        const existingIndex = prev.findIndex(log => 
          log.goal_id === data.log.goal_id && log.log_date === data.log.log_date
        );
        
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = data.log;
          return updated;
        } else {
          return [...prev, data.log];
        }
      });
      
      return data.log;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save daily log';
      toast.error(errorMessage);
      throw err;
    }
  };

  const updateLog = async (logData: Partial<DailyLog>) => {
    try {
      const response = await fetch(`${API_ENDPOINTS.DAILY_LOGS}/${logData.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update daily log');
      }
      
      const data = await response.json();
      setLogs(prev => prev.map(log => 
        log.id === logData.id ? data.log : log
      ));
      return data.log;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update daily log';
      toast.error(errorMessage);
      throw err;
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [date]);

  return {
    logs,
    loading,
    error,
    createOrUpdateLog,
    updateLog,
    refetch: fetchLogs,
  };
}
