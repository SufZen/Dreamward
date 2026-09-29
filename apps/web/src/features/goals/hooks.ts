import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { GoalProgress, GoalStatus } from '@dreamward/shared';
import { api } from '@/lib/api';

export interface Goal {
  id: string;
  categoryId: string | null;
  title: string;
  description: string | null;
  status: GoalStatus;
  targetDate: number | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface GoalsSummary {
  total: number;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
}

export const useGoals = () => useQuery({ queryKey: ['goals'], queryFn: () => api.get<Goal[]>('/goals') });

export const useGoalsSummary = () =>
  useQuery({ queryKey: ['goals-summary'], queryFn: () => api.get<GoalsSummary>('/goals/summary') });

/** Computed rollups keyed by goal id: pct done, weekly momentum, risk. */
export const useGoalsProgress = () =>
  useQuery({
    queryKey: ['goals-progress'],
    queryFn: () => api.get<Record<string, GoalProgress>>('/goals/progress'),
  });

function useInvalidateGoals() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['goals'] });
    qc.invalidateQueries({ queryKey: ['goals-summary'] });
    qc.invalidateQueries({ queryKey: ['goals-progress'] });
  };
}

export function useCreateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (vars: { title: string; categoryId?: string | null }) => api.post<Goal>('/goals', vars),
    onSuccess: invalidate,
  });
}

export function useUpdateGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (vars: { id: string; title?: string; description?: string | null; categoryId?: string | null }) =>
      api.put<Goal>(`/goals/${vars.id}`, { ...vars, id: undefined }),
    onSuccess: invalidate,
  });
}

export function useSetGoalStatus() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (vars: { id: string; status: GoalStatus; note?: string }) =>
      api.patch(`/goals/${vars.id}/status`, { status: vars.status, note: vars.note }),
    onSuccess: invalidate,
  });
}

export function useDeleteGoal() {
  const invalidate = useInvalidateGoals();
  return useMutation({
    mutationFn: (id: string) => api.del(`/goals/${id}`),
    onSuccess: invalidate,
  });
}
