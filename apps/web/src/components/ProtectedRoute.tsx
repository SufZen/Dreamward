import { Navigate, useLocation } from 'react-router-dom';
import { useMe } from '@/features/auth/useAuth';
import { useLang } from '@/lib/lang';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading, isError } = useMe();
  const location = useLocation();
  const { t } = useLang();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-fg-muted">{t('loading')}</div>;
  }
  if (isError || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}
