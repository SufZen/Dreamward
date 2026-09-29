import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Action, ActionPriority, ActionLinkType } from '@dreamward/shared';
import { api } from '@/lib/api';

export type { Action };

export interface ActionFilters {
  status?: 'todo' | 'done';
  priority?: ActionPriority;
  goalId?: string;
}

const qs = (f: ActionFilters) => {
  const p = new URLSearchParams();
  if (f.status) p.set('status', f.status);
  if (f.priority) p.set('priority', f.priority);
  if (f.goalId) p.set('goal_id', f.goalId);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const useActions = (filters: ActionFilters = {}) =>
  useQuery({
    queryKey: ['actions', filters],
    queryFn: () => api.get<Action[]>(`/actions${qs(filters)}`),
  });

function useInvalidateActions() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['actions'] });
    // Action completion moves goal progress rollups.
    qc.invalidateQueries({ queryKey: ['goals-progress'] });
  };
}

export function useCreateAction() {
  const invalidate = useInvalidateActions();
  return useMutation({
    mutationFn: (vars: {
      title: string;
      description?: string | null;
      dueDate?: number | null;
      priority?: ActionPriority;
      goalId?: string | null;
      linkedType?: ActionLinkType | null;
      linkedId?: string | null;
    }) => api.post<Action>('/actions', vars),
    onSuccess: invalidate,
  });
}

export function useUpdateAction() {
  const invalidate = useInvalidateActions();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      title?: string;
      description?: string | null;
      dueDate?: number | null;
      status?: 'todo' | 'done';
      priority?: ActionPriority;
      linkedType?: ActionLinkType | null;
      linkedId?: string | null;
    }) => api.patch<Action>(`/actions/${vars.id}`, { ...vars, id: undefined }),
    onSuccess: invalidate,
  });
}

export function useDeleteAction() {
  const invalidate = useInvalidateActions();
  return useMutation({
    mutationFn: (id: string) => api.del(`/actions/${id}`),
    onSuccess: invalidate,
  });
}

export function useReorderActions() {
  const invalidate = useInvalidateActions();
  return useMutation({
    mutationFn: (order: string[]) => api.patch('/actions/reorder', { order }),
    onSuccess: invalidate,
  });
}
