import { LoaderFunctionArgs } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";
import { requireUserWithRole } from "~/modules/auth/auth.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // Ensure user is authorized
  await requireUserWithRole(request, "admin");

  const documentId = params.documentId;

  // Find the document
  const document = await prisma.documentApproval.findUnique({
    where: { id: documentId },
    select: { documentUrl: true },
  });

  if (!document) {
    throw new Response("Document not found", { status: 404 });
  }

  // Fetch the PDF from S3
  const response = await fetch(document.documentUrl);
  const arrayBuffer = await response.arrayBuffer();

  // Return the PDF with appropriate headers
  return new Response(arrayBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="document.pdf"`,
      "Cache-Control": "max-age=300",
    },
  });
}
