import { NavLink, useNavigate, type NavLinkProps } from 'react-router-dom';
import { withViewTransition } from '@dreamward/design-system';

/**
 * NavLink whose navigation runs inside a view transition (the page fades and
 * rises; the shell stays still). React Router's own `viewTransition` prop
 * needs a data router; the app uses <BrowserRouter>, so we do it here.
 * Modified clicks (new tab, etc.) keep the browser's default behaviour.
 */
export function TransitionNavLink({ onClick, ...props }: NavLinkProps) {
  const navigate = useNavigate();
  return (
    <NavLink
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        withViewTransition(() => navigate(props.to));
      }}
    />
  );
}
