import {
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { QueryClient } from "@tanstack/react-query";

import type { AuthContextValue } from "@/app/providers/auth-provider";
import { AppShellLayout } from "@/app/layouts/app-shell-layout";
import { NotFoundPage } from "@/app/router/not-found-page";
import { LoadingState } from "@/components/feedback/loading-state";

interface RouterContext {
  auth: AuthContextValue;
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <div className="min-h-screen">
        <Outlet />
      </div>
      {import.meta.env.DEV ? (
        <TanStackRouterDevtools position="bottom-right" />
      ) : null}
    </>
  ),
  notFoundComponent: NotFoundPage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated && !context.auth.isBootstrapping) {
      throw redirect({ to: "/" });
    }
  },
  component: lazyRouteComponent(() => import("@/features/auth/login-page")),
});

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/forgot-password",
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated && !context.auth.isBootstrapping) {
      throw redirect({ to: "/" });
    }
  },
  component: lazyRouteComponent(
    () => import("@/features/auth/forgot-password-page"),
  ),
});

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reset-password",
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated && !context.auth.isBootstrapping) {
      throw redirect({ to: "/" });
    }
  },
  component: lazyRouteComponent(
    () => import("@/features/auth/reset-password-page"),
  ),
});

const appLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app-layout",
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated && !context.auth.isBootstrapping) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShellLayout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/",
  component: lazyRouteComponent(
    () => import("@/features/dashboard/dashboard-page"),
  ),
});

const reportsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/reports",
  component: lazyRouteComponent(
    () => import("@/features/reports/reports-page"),
  ),
});

const reportContractDrilldownRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/reports/contracts/$contractId",
  component: lazyRouteComponent(
    () => import("@/features/reports/contract-drilldown-page"),
  ),
});

const companiesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/companies",
  component: lazyRouteComponent(
    () => import("@/features/companies/companies-page"),
  ),
});

const projectsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/projects",
  component: lazyRouteComponent(
    () => import("@/features/projects/projects-page"),
  ),
});

const contractsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/contracts",
  component: lazyRouteComponent(
    () => import("@/features/contracts/contracts-page"),
  ),
});

const vendorsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/vendors",
  component: lazyRouteComponent(
    () => import("@/features/vendors/vendors-page"),
  ),
});

const quotationsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/quotations",
  component: lazyRouteComponent(
    () => import("@/features/quotations/quotations-page"),
  ),
});

const materialsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/materials",
  component: lazyRouteComponent(
    () => import("@/features/materials/materials-page"),
  ),
});

const materialRequisitionsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/materials/requisitions",
  component: lazyRouteComponent(
    () => import("@/features/material-requisitions/material-requisitions-page"),
  ),
});

const materialReceiptsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/materials/receipts",
  component: lazyRouteComponent(
    () => import("@/features/material-receipts/material-receipts-page"),
  ),
});

const materialIssuesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/materials/issues",
  component: lazyRouteComponent(
    () => import("@/features/material-issues/material-issues-page"),
  ),
});

const materialAdjustmentsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/materials/adjustments",
  component: lazyRouteComponent(
    () => import("@/features/material-adjustments/material-adjustments-page"),
  ),
});

const stockLedgerRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/stock-ledger",
  component: lazyRouteComponent(
    () => import("@/features/stock-ledger/stock-ledger-page"),
  ),
});

const labourRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/labour",
  component: lazyRouteComponent(() => import("@/features/labour/labour-page")),
});

const labourContractorsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/labour/contractors",
  component: lazyRouteComponent(
    () => import("@/features/labour-contractors/labour-contractors-page"),
  ),
});

const labourAttendanceRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/labour/attendance",
  component: lazyRouteComponent(
    () => import("@/features/labour-attendance/labour-attendance-page"),
  ),
});

const labourBillsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/labour/bills",
  component: lazyRouteComponent(
    () => import("@/features/labour-bills/labour-bills-page"),
  ),
});

const labourAdvancesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/labour/advances",
  component: lazyRouteComponent(
    () => import("@/features/labour-advances/labour-advances-page"),
  ),
});

const raBillsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/ra-bills",
  component: lazyRouteComponent(
    () => import("@/features/ra-bills/ra-bills-page"),
  ),
});

const paymentsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/payments",
  component: lazyRouteComponent(
    () => import("@/features/payments/payments-page"),
  ),
});

const siteExpensesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/site-expenses",
  component: lazyRouteComponent(
    () => import("@/features/site-expenses/site-expenses-page"),
  ),
});

const auditLogsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/audit-logs",
  component: lazyRouteComponent(() => import("@/features/audit/audit-page")),
});

const aiBoundaryRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/ai-boundary",
  component: lazyRouteComponent(
    () => import("@/features/ai-boundary/ai-boundary-page"),
  ),
});

const boqRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/boq",
  component: lazyRouteComponent(() => import("@/features/boq/boq-page")),
});

const measurementsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/measurements",
  component: lazyRouteComponent(
    () => import("@/features/measurements/measurements-page"),
  ),
});

const workDoneRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/work-done",
  component: lazyRouteComponent(
    () => import("@/features/work-done/work-done-page"),
  ),
});

const securedAdvancesRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/secured-advances",
  component: lazyRouteComponent(
    () => import("@/features/secured-advances/secured-advances-page"),
  ),
});

const documentsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/documents",
  component: lazyRouteComponent(
    () => import("@/features/documents/documents-page"),
  ),
});

const usersRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/admin/users",
  component: lazyRouteComponent(
    () => import("@/features/admin/users-page"),
  ),
});

const labourProductivityRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/labour/productivity",
  component: lazyRouteComponent(
    () => import("@/features/labour-productivity/labour-productivity-page"),
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  appLayoutRoute.addChildren([
    dashboardRoute,
    reportsRoute,
    reportContractDrilldownRoute,
    companiesRoute,
    projectsRoute,
    contractsRoute,
    vendorsRoute,
    quotationsRoute,
    materialsRoute,
    materialRequisitionsRoute,
    materialReceiptsRoute,
    materialIssuesRoute,
    materialAdjustmentsRoute,
    stockLedgerRoute,
    labourRoute,
    labourContractorsRoute,
    labourAttendanceRoute,
    labourBillsRoute,
    labourAdvancesRoute,
    raBillsRoute,
    paymentsRoute,
    siteExpensesRoute,
    auditLogsRoute,
    aiBoundaryRoute,
    boqRoute,
    measurementsRoute,
    workDoneRoute,
    securedAdvancesRoute,
    documentsRoute,
    usersRoute,
    labourProductivityRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  context: {
    auth: undefined as unknown as AuthContextValue,
    queryClient: undefined as unknown as QueryClient,
  },
  defaultPreload: "intent",
  defaultPendingComponent: () => <LoadingState />,
});

export function AppRouterProvider({ context }: { context: RouterContext }) {
  return <RouterProvider router={router} context={context} />;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
