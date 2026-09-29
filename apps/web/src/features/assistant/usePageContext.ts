import { useLocation, useParams } from 'react-router-dom';
import type { PageContext } from '@dreamward/shared';

/** Map the current route to the pageContext sent to the agent. */
export function usePageContext(): PageContext {
  const { pathname } = useLocation();
  const params = useParams();
  const ctx: PageContext = { route: pathname };
  if (params.categoryId) ctx.categoryId = params.categoryId;
  return ctx;
}
