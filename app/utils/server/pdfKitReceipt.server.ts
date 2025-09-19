import { format } from "date-fns";
import fs, { constants } from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import logger from "~/lib/logger.server";
import { BookingWithRelations } from "~/types";

function formatBookingDate(d: Date): string {
  return format(d, "MMMM do, yyyy - h:mm a");
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "NGN" }).format(amount);
}

export async function generatePdfWithPdfKit(booking: BookingWithRelations): Promise<Buffer> {
  const doc = new PDFDocument({
    size: [612, 792], // US Letter size
    margins: {
      top: 40,
      bottom: 40,
      left: 612 * 0.2, // 20% margin
      right: 612 * 0.2, // 20% margin
    },
    font: "Courier", // Set default font
  });

  const passThrough = new PassThrough();
  doc.pipe(passThrough);

  // Try multiple possible font paths for different environments
  const possibleFontPaths = [
    // Production Vercel path
    path.join(process.cwd(), "build", "client", "fonts", "DancingScript-Regular.ttf"),
    // Development path
    path.join(process.cwd(), "public", "fonts", "DancingScript-Regular.ttf"),
    // Build output path
    path.join(process.cwd(), "build", "public", "fonts", "DancingScript-Regular.ttf"),
    // Relative to current file
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "public",
      "fonts",
      "DancingScript-Regular.ttf",
    ),
  ];

  let fontBuffer: Buffer | null = null;
  let dancingScriptPath: string | null = null;

  for (const fontPath of possibleFontPaths) {
    try {
      fontBuffer = fs.readFileSync(fontPath);
      dancingScriptPath = fontPath;
      logger.info(`Font loaded successfully from: ${fontPath}`);
      break;
    } catch (error) {
      logger.debug(`Font not found at: ${fontPath} - ${error}`);
    }
  }

  if (!dancingScriptPath || !fontBuffer) {
    const errorMsg = `Dancing Script font not found at any of the expected paths: ${possibleFontPaths.join(", ")}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  doc.registerFont("DancingScript", fontBuffer);

  const contentLeft = doc.page.margins.left;
  const contentRight = doc.page.width - doc.page.margins.right;

  doc.font("DancingScript").fontSize(28).text("Chauffeurly", { align: "center" });
  doc.moveDown(1.25);

  doc.font("Courier-Bold").fontSize(22).text("RECEIPT", { align: "center" });
  doc.moveDown(0.5);

  const bookingReference = booking.bookingReference;

  if (bookingReference) {
    doc.font("Courier").fontSize(10).fillColor("#666").text(bookingReference, { align: "center" });
    doc.moveDown(3);
  }

  const drawLine = () => {
    doc
      .moveTo(contentLeft, doc.y)
      .lineTo(contentRight, doc.y)
      .lineWidth(0.5)
      .strokeColor("#ccc")
      .stroke();
  };

  const drawDashedLine = () => {
    doc
      .moveTo(contentLeft, doc.y)
      .lineTo(contentRight, doc.y)
      .lineWidth(0.5)
      .dash(5, { space: 3 })
      .strokeColor("#ccc")
      .stroke()
      .undash();
  };

  const twoColumnText = (
    label: string,
    value: string,
    { isBold = false, fontSize = 10 }: { isBold?: boolean; fontSize?: number } = {},
  ) => {
    const y = doc.y;
    doc
      .font(isBold ? "Courier-Bold" : "Courier")
      .fontSize(fontSize)
      .text(label, contentLeft, y);

    doc.font("Courier").fontSize(fontSize).text(value, contentLeft, y, { align: "right" });
    doc.moveDown(1);
  };

  doc.fillColor("black").font("Courier-Bold").fontSize(12).text("Service Details");
  doc.moveDown(1);

  twoColumnText("Vehicle:", `${booking.car.make} ${booking.car.model} ${booking.car.year}`);
  twoColumnText("Color:", `${booking.car.color}`);
  twoColumnText("Chauffeur:", `${booking.chauffeur?.name ?? "N/A"}`);
  doc.moveDown(0.5);

  drawLine();
  doc.moveDown(1);

  doc.font("Courier-Bold").fontSize(12).text("Booking Period");
  doc.moveDown(0.75);

  twoColumnText("Start:", formatBookingDate(booking.startDate));
  twoColumnText("End:", formatBookingDate(booking.endDate));
  doc.moveDown(0.5);

  drawLine();
  doc.moveDown(1.5);

  doc.font("Courier-Bold").fontSize(12).text("Location Details");
  doc.moveDown(0.75);

  doc.font("Courier").fontSize(10);
  doc.text("Pickup Location");
  doc.moveDown(0.6);
  doc.text(booking.pickupLocation, { indent: 10 });
  doc.moveDown(1);

  doc.text("Dropoff Location");
  doc.moveDown(0.6);
  doc.text(booking.returnLocation, { indent: 10 });
  doc.moveDown(1);

  drawLine();
  doc.moveDown(1.5);

  doc.font("Courier-Bold").fontSize(12).text("Payment Summary");
  doc.moveDown(0.75);

  const totalDays = booking.legs.length;

  twoColumnText(
    `Net Total (${totalDays} day${totalDays > 1 ? "s" : ""})`,
    formatCurrency(Number(booking.netTotal ?? 0)),
  );

  let totalExtendedHours = 0;
  let extensionTotalAmount = 0;

  for (const leg of booking.legs) {
    totalExtendedHours += leg.extensions.reduce(
      (acc, ext) => acc + Number(ext.extendedDurationHours ?? 0),
      0,
    );
    extensionTotalAmount += leg.extensions.reduce(
      (acc, extension) => acc + Number(extension.totalAmount),
      0,
    );
  }

  if (extensionTotalAmount > 0) {
    twoColumnText(
      `Extension (${totalExtendedHours} hour${totalExtendedHours > 1 ? "s" : ""})`,
      formatCurrency(extensionTotalAmount),
    );
  }

  if (Number(booking.securityDetailCost ?? 0) > 0) {
    twoColumnText(
      `Security Detail (${totalDays} day${totalDays > 1 ? "s" : ""})`,
      formatCurrency(Number(booking.securityDetailCost)),
    );
  }

  if (Number(booking.platformCustomerServiceFeeAmount ?? 0) > 0) {
    twoColumnText(
      `Platform Fee (${booking.platformCustomerServiceFeeRatePercent}%)`,
      formatCurrency(Number(booking.platformCustomerServiceFeeAmount ?? 0)),
    );
  }

  twoColumnText(`VAT (${booking.vatRatePercent}%)`, formatCurrency(Number(booking.vatAmount ?? 0)));

  doc.moveDown(0.5);
  drawLine();
  doc.moveDown(1);

  twoColumnText("Total Amount", formatCurrency(Number(booking.totalAmount ?? 0)), { isBold: true });
  doc.moveDown(0.5);

  drawLine();
  doc.moveDown(1);

  doc.font("Courier").fontSize(10).fillColor("#666");
  doc.text("Thank you for your business!", { align: "center" });
  doc.moveDown(1.2);

  drawDashedLine();
  doc.moveDown(1.2);

  const generatedOn = `Generated on ${format(new Date(), "MM/dd/yyyy")}`;
  doc.fontSize(10).text(generatedOn, { align: "center" });

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    const buffers: Buffer[] = [];
    passThrough.on("data", (chunk) => buffers.push(chunk));
    passThrough.on("end", () => resolve(Buffer.concat(buffers)));
    passThrough.on("error", (error) => resolve(Buffer.from(error.message)));
  });

  return pdfBuffer;
}
