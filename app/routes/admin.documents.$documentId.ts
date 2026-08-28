import { getAdminDocument } from "~/api/admin/documents/documents.server";
import type { Route } from "./+types/admin.documents.$documentId";

export async function loader({ request, params }: Route.LoaderArgs) {
  const upstream = await getAdminDocument({
    request,
    documentId: params.documentId,
  });
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Type": upstream.headers.get("content-type") ?? "application/pdf",
  });
  const contentDisposition = upstream.headers.get("content-disposition");
  const contentLength = upstream.headers.get("content-length");
  if (contentDisposition) {
    headers.set("Content-Disposition", contentDisposition);
  }
  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
