import { Prisma } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";
import { uploadImageToS3 } from "./s3.server";

export async function isCarAvailable(
  carId: string,
  startDate: Date,
  endDate: Date
): Promise<boolean> {
  const car = await prisma.car.findUnique({
    where: { id: carId },
    include: {
      bookings: {
        where: {
          //   Only check active bookings
          status: {
            in: ["CONFIRMED", "ACTIVE"],
          },
          // Check for any date overlap
          OR: [
            // New booking starts during an existing booking
            {
              // startDate: { lte: endDate },
              // endDate: { gte: startDate },

              startDate: {
                lte: new Date(endDate.setHours(23, 59, 59, 999)),
              },
              endDate: {
                gte: new Date(startDate.setHours(0, 0, 0, 0)),
              },
            },
          ],
        },
      },
    },
  });

  if (!car) {
    throw new Error("Car not found");
  }

  // Car is available if it's status is AVAILABLE and has no overlapping bookings
  return car.bookings.length === 0;
}

export async function createCar({
  images,
  ...data
}: Omit<Prisma.CarCreateInput, "images"> & { images: File[] }) {
  return prisma.$transaction(async (transaction) => {
    const car = await transaction.car.create({ data });

    try {
      const imageUrls = await Promise.all(
        images.map((image) => uploadImageToS3(image, car))
      );

      // Update car with image URLs within same transaction
      return transaction.car.update({
        where: { id: car.id },
        data: { images: imageUrls },
      });
    } catch (error) {
      // Transaction will automatically rollback if error occurs
      // Delete car if image upload fails
      await transaction.car.delete({
        where: { id: car.id },
      });

      throw new Error("Failed to upload images", { cause: error });
    }
  });
}
