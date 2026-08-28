import { createContext, data, type RouterContextProvider } from "react-router";

import { HTTP_STATUS } from "~/api/http-status";
import { requireAdminOrStaff } from "~/auth/admin-session.server";

export type AdminSession = Awaited<ReturnType<typeof requireAdminOrStaff>>;

export const adminSessionContext = createContext<AdminSession>();

export function requireAdminContext(context: Readonly<RouterContextProvider>) {
  if (context.get(adminSessionContext).role !== "admin") {
    throw data(null, { status: HTTP_STATUS.FORBIDDEN });
  }
}
