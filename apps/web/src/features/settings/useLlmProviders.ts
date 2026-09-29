import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LlmProviderPublic, ToolsMode } from '@dreamward/shared';
import { api } from '@/lib/api';

export interface ProviderInput {
  name: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  toolsMode?: ToolsMode;
  contextLength?: number | null;
}

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  toolsDetected: boolean | null;
  error?: string;
}

export const useProviders = () =>
  useQuery({ queryKey: ['llm-providers'], queryFn: () => api.get<LlmProviderPublic[]>('/llm/providers') });

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['llm-providers'] });
}

export function useCreateProvider() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProviderInput) => api.post<LlmProviderPublic>('/llm/providers', input),
    onSuccess: invalidate,
  });
}

export function useUpdateProvider() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...input }: ProviderInput & { id: string }) =>
      api.patch<LlmProviderPublic>(`/llm/providers/${id}`, input),
    onSuccess: invalidate,
  });
}

export function useDeleteProvider() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.del(`/llm/providers/${id}`),
    onSuccess: invalidate,
  });
}

export function useActivateProvider() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post(`/llm/providers/${id}/activate`),
    onSuccess: invalidate,
  });
}

export function useTestProvider() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => api.post<TestResult>(`/llm/providers/${id}/test`),
    onSuccess: invalidate, // toolsDetected may have been persisted
  });
}
