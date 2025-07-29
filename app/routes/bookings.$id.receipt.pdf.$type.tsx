import type { LoaderFunction } from "@remix-run/node";
import { prisma } from "~/modules/db/db.server";
import { generatePdfWithPdfKit } from "~/utils/server/pdfKitReceipt.server";

export const loader: LoaderFunction = async ({ params }) => {
  const booking = await prisma.booking.findUnique({
    where: { id: params.id },
    include: {
      car: { include: { owner: true } },
      user: true,
      chauffeur: true,
      legs: {
        include: { extensions: true },
        orderBy: { legDate: "asc" },
      },
    },
  });

  if (!booking) {
    throw new Response("Booking not found", { status: 404 });
  }

  const pdfBytes = await generatePdfWithPdfKit(booking);

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${booking.id}.pdf"`,
    },
  });
};
