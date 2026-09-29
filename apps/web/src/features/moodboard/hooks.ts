import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, uploadFile } from '@/lib/api';

export interface Asset {
  id: string;
  originalPath: string;
  webPath: string;
  thumbPath: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  source: 'pptx_import' | 'upload';
  alt: string | null;
  createdAt: number;
  usedIn?: number;
}

/** Thrown by useDeleteAsset when an asset is still on one or more boards. */
export interface AssetInUse {
  error: 'in_use';
  boards: { id: string; title: string }[];
}

export interface BoardItem {
  id: string;
  moodboardId?: string;
  assetId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  crop: { x: number; y: number; w: number; h: number } | null;
  cornerRadius: number;
  opacity: number;
}

export interface Board {
  id: string;
  title: string;
  theme: string | null;
  categoryId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  background: { color?: string } | null;
  templateId: string | null;
  visionStatement: string | null;
  sortOrder: number;
  cover?: string | null;
}

export interface BoardWithItems extends Board {
  items: BoardItem[];
}

export const useBoards = () => useQuery({ queryKey: ['boards'], queryFn: () => api.get<Board[]>('/moodboards') });

export const useBoard = (id: string | undefined) =>
  useQuery({
    queryKey: ['board', id],
    queryFn: () => api.get<BoardWithItems>(`/moodboards/${id}`),
    enabled: !!id,
  });

export const useAssets = () => useQuery({ queryKey: ['assets'], queryFn: () => api.get<Asset[]>('/assets') });

export function useSaveItems(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: BoardItem[]) =>
      api.put(`/moodboards/${boardId}/items`, {
        items: items.map(({ moodboardId: _omit, ...it }) => ({ ...it, crop: it.crop ?? { x: 0, y: 0, w: 1, h: 1 } })),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
  });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (title: string) => api.post<Board>('/moodboards', { title }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['boards'] }),
  });
}

export function useUploadAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile<Asset>('/assets', file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assets'] }),
  });
}

/**
 * Delete an asset. Without `force`, the API returns 409 + the boards using it
 * (surfaced as ApiError with status 409); pass force to detach + delete.
 * Invalidates both the asset list and any open boards (items may have changed).
 */
export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force }: { id: string; force?: boolean }) =>
      api.del(`/assets/${id}${force ? '?force=true' : ''}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['boards'] });
      qc.invalidateQueries({ queryKey: ['board'] });
    },
  });
}
