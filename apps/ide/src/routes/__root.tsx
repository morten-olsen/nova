import { createRootRoute, Outlet } from '@tanstack/react-router';

const Route = createRootRoute({ component: () => <Outlet /> });

export { Route };
