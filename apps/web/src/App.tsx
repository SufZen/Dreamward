import { lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { InvitePage } from '@/features/auth/InvitePage';
import { SetupPage } from '@/features/auth/SetupPage';
import { useMe } from '@/features/auth/useAuth';

// Feature pages load on demand — keeps the initial bundle to the shell + login.
const lazyNamed = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, key: K) =>
  lazy(() => loader().then((m) => ({ default: m[key] })));

const Dashboard = lazyNamed(() => import('@/features/dashboard/Dashboard'), 'Dashboard');
const CategoryPage = lazyNamed(() => import('@/features/book/CategoryPage'), 'CategoryPage');
const ContentBlockPage = lazyNamed(() => import('@/features/book/ContentBlockPage'), 'ContentBlockPage');
const LifeVisionPage = lazyNamed(() => import('@/features/book/LifeVisionPage'), 'LifeVisionPage');
const GoalsPage = lazyNamed(() => import('@/features/goals/GoalsPage'), 'GoalsPage');
const ActionsPage = lazyNamed(() => import('@/features/actions/ActionsPage'), 'ActionsPage');
const JournalPage = lazyNamed(() => import('@/features/journal/JournalPage'), 'JournalPage');
const SnapshotsPage = lazyNamed(() => import('@/features/snapshots/SnapshotsPage'), 'SnapshotsPage');
const SettingsPage = lazyNamed(() => import('@/features/settings/SettingsPage'), 'SettingsPage');
const GalleryPage = lazyNamed(() => import('@/features/gallery/GalleryPage'), 'GalleryPage');
const AdminPage = lazyNamed(() => import('@/features/admin/AdminPage'), 'AdminPage');
const BoardGallery = lazyNamed(() => import('@/features/moodboard/BoardGallery'), 'BoardGallery');
const CollageEditor = lazyNamed(() => import('@/features/moodboard/CollageEditor'), 'CollageEditor');
const ChapterPage = lazyNamed(() => import('@/features/chapter/ChapterPage'), 'ChapterPage');
const IkigaiPage = lazyNamed(() => import('@/features/ikigai/IkigaiPage'), 'IkigaiPage');
const StartPage = lazyNamed(() => import('@/features/onboarding/StartPage'), 'StartPage');

const Loading = () => <p className="p-6 text-fg-muted">…</p>;

/** Gate for admin-only routes — non-admins bounce to the dashboard. */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <Loading />;
  if (me?.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function ShellRoutes() {
  return (
    <Routes>
      {/* AppShell wraps a <Suspense> around the Outlet, so lazy pages stream in. */}
      <Route element={<AppShell />}>
        <Route index element={<Dashboard />} />
        <Route path="chapter" element={<ChapterPage />} />
        <Route path="ikigai" element={<IkigaiPage />} />
        <Route path="start" element={<StartPage />} />
        <Route path="book/cover" element={<ContentBlockPage />} />
        <Route path="book/front/:blockId" element={<ContentBlockPage />} />
        <Route path="book/implementation/:blockId" element={<ContentBlockPage />} />
        <Route path="book/category/:categoryId" element={<CategoryPage />} />
        <Route path="book/life-vision" element={<LifeVisionPage />} />
        <Route path="goals" element={<GoalsPage />} />
        <Route path="actions" element={<ActionsPage />} />
        <Route path="journal" element={<JournalPage />} />
        <Route path="journal/:entryId" element={<JournalPage />} />
        <Route path="moodboard" element={<BoardGallery />} />
        <Route path="moodboard/:boardId" element={<CollageEditor />} />
        <Route path="gallery" element={<GalleryPage />} />
        <Route path="snapshots" element={<SnapshotsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <ShellRoutes />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
