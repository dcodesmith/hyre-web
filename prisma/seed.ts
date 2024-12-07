import { vehicles } from "~/vehicles";
import { prisma } from "../app/modules/db/db.server";
import { BookingStatus, PaymentStatus, Status } from "@prisma/client";
import path from "node:path";
import fs from "node:fs/promises";
import { uploadImageToS3 } from "~/services/s3.server";
import { faker } from "@faker-js/faker";

type MigrationRecord = {
  finished_at: Date | null; // The `finished_at` field can be null for unfinished migrations
};

async function getCarImages(basePattern: string) {
  const images: File[] = [];

  try {
    const carsDir = path.join(process.cwd(), "public", "cars");
    const files = await fs.readdir(carsDir);
    const matchingFiles = files.filter((file) => file.startsWith(basePattern));

    for (const filename of matchingFiles) {
      const filePath = path.join(carsDir, filename);
      const extname = path.extname(filePath);
      const buffer = await fs.readFile(filePath);
      const file = new File([buffer], filename, {
        type: `image/${extname.slice(1)}`,
      });

      images.push(file);
    }
  } catch (error) {
    console.warn(`Error loading images for ${basePattern}:`, error);
  }

  return images;
}

async function shouldRunSeed() {
  const latestMigration = await prisma.$queryRaw<MigrationRecord[]>`
      SELECT finished_at FROM _prisma_migrations
      ORDER BY finished_at DESC LIMIT 1;
  `;
  return latestMigration.length > 0 && !!latestMigration[0].finished_at;
}

async function seed() {
  // Clear database in a single transaction
  await prisma.$transaction(async (transaction) => {
    await transaction.booking.deleteMany();
    await transaction.car.deleteMany();
    await transaction.user.deleteMany();
    await transaction.permission.deleteMany();
    await transaction.role.deleteMany();
  });

  /**
   * Users, Roles and Permissions.
   */
  const entities = ["user"];
  const actions = ["create", "read", "update", "delete"];
  const accesses = ["own", "any"] as const;

  for (const entity of entities) {
    for (const action of actions) {
      for (const access of accesses) {
        await prisma.permission.create({ data: { entity, action, access } });
      }
    }
  }

  await prisma.role.create({
    data: {
      name: "admin",
      permissions: {
        connect: await prisma.permission.findMany({
          select: { id: true },
          where: { access: "any" },
        }),
      },
    },
  });

  await prisma.role.create({
    data: {
      name: "fleetOwner",
      permissions: {
        connect: await prisma.permission.findMany({
          select: { id: true },
          where: { access: "own" },
        }),
      },
    },
  });

  await prisma.role.create({
    data: {
      name: "chauffeur",
      permissions: {
        connect: await prisma.permission.findMany({
          select: { id: true },
          where: { access: "own" },
        }),
      },
    },
  });

  await prisma.role.create({
    data: {
      name: "user",
      permissions: {
        connect: await prisma.permission.findMany({
          select: { id: true },
          where: { access: "own" },
        }),
      },
    },
  });

  await prisma.user.create({
    select: { id: true },
    data: {
      email: "admin@admin.com",
      username: "admin",
      name: "Oga Agba",
      roles: { connect: [{ name: "admin" }, { name: "user" }] },
    },
  });

  const fleetOwners = [
    {
      name: "Cool FleetOwner",
      email: "cool@fleetowner.com",
    },
    {
      name: "Nerdy FleetOwner",
      email: "nerdy@fleetowner.com",
    },
  ];

  const user = await prisma.user.create({
    select: { id: true },
    data: {
      email: "dcodesmith@gmail.com",
      username: "dcodesmith",
      name: "Adedamola Kolawole",
      roles: { connect: [{ name: "user" }] },
    },
  });

  for (const fleetOwner of fleetOwners) {
    const createdFleetOwner = await prisma.user.create({
      select: { id: true },
      data: {
        email: fleetOwner.email,
        username: fleetOwner.name,
        name: fleetOwner.name,
        roles: { connect: [{ name: "fleetOwner" }] },
      },
    });

    // Create 5 chauffeurs for each fleet owner
    for (let i = 0; i < 5; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();

      await prisma.user.create({
        select: { id: true },
        data: {
          email: faker.internet.email({
            firstName: firstName.toLowerCase(),
            lastName: lastName.toLowerCase(),
          }),
          username: faker.internet.displayName(),
          name: `${firstName} ${lastName}`,
          phoneNumber: faker.helpers.arrayElement([
            "+2348023456789",
            "+2348134567890",
            "+2348045678901",
            "+2348156789012",
            "+2348067890123",
            "+2348178901234",
            "+2348089012345",
            "+2348190123456",
            "+2348001234567",
            "+2348112345678",
          ]),
          roles: { connect: [{ name: "chauffeur" }] },
          fleetOwnerId: createdFleetOwner.id,
        },
      });
    }

    const cars = vehicles.map((vehicle) => ({
      ...vehicle,
      price: [90000, 100000, 110000, 120000, 130000][
        Math.floor(Math.random() * 5)
      ],
      color: ["Blue", "Silver", "Black", "White"][
        Math.floor(Math.random() * 4)
      ],
      year: [2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024][
        Math.floor(Math.random() * 10)
      ],
      status: Object.values(Status)[Math.floor(Math.random() * 4)] as Status,
      ownerId: createdFleetOwner.id,
      registrationNumber: `${faker.helpers.arrayElement([
        "LAG",
        "ABJ",
        "KAN",
        "KAD",
        "PH",
        "IKJ",
      ])} ${faker.number.int({
        min: 100,
        max: 999,
      })} ${faker.helpers.arrayElement([
        "AA",
        "AB",
        "AC",
        "AD",
        "AE",
        "AF",
        "AG",
        "AH",
      ])}`,
    }));

    const createdCars = await prisma.car.createManyAndReturn({
      data: cars,
    });

    for (const car of createdCars) {
      const formattedMake = car.make.toLowerCase().replace(/\s+/g, "-");
      const formattedModel = car.model.toLowerCase().replace(/\s+/g, "-");
      const basePattern = `${formattedMake}-${formattedModel}`;
      const carImages = await getCarImages(basePattern);

      const imageUrls = await Promise.all(
        carImages.map((image) => uploadImageToS3(image, car))
      );

      if (imageUrls.length > 0) {
        await prisma.car.update({
          where: { id: car.id },
          data: { images: imageUrls, status: Status.AVAILABLE },
        });
      }
    }

    // Create Cars first, then create bookings for them.

    const bookedCars = await prisma.car.findMany({
      where: { status: Status.BOOKED },
    });

    const bookings = bookedCars.map((car) => {
      // if (car.status !== "BOOKED") return car;
      // const endDate = new Date();
      // // Random duration between 1-7 days
      // const durationDays = Math.floor(Math.random() * 7) + 1;
      // endDate.setDate(endDate.getDate() + durationDays);
      // // Random start date between now and 7 days ago
      // const startDate = new Date();
      // const daysAgo = Math.floor(Math.random() * 7);
      // // Create dates for yesterday, today, and tomorrow
      // const today = new Date();
      // // const yesterday = new Date(today);
      // // yesterday.setDate(today.getDate() - 1);
      // const tomorrow = new Date(today);
      // tomorrow.setDate(today.getDate() + 1);

      // // Randomly select one of the three dates
      // // yesterday
      // const possibleStartDates = [today, tomorrow];
      // const startTimes = [8, 9, 10, 11, 12];
      // possibleStartDates.forEach((date) => {
      //   const startHour =
      //     startTimes[Math.floor(Math.random() * startTimes.length)];
      //   date.setHours(startHour, 0, 0, 0);
      //   endDate.setHours(startHour + 12, 0, 0, 0);
      // });
      // startDate.setTime(
      //   possibleStartDates[Math.floor(Math.random() * 2)].getTime()
      // );
      // startDate.setDate(endDate.getDate() - (durationDays + daysAgo));

      // if (car.status !== "BOOKED") return car;

      const now = new Date();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      // Determine if we should use today or tomorrow as start date
      const currentHour = now.getHours();
      const startDate = currentHour < 8 ? today : tomorrow;

      // Set random start hour (8am-12pm)
      const startHours = [8, 9, 10, 11, 12];
      const startHour =
        startHours[Math.floor(Math.random() * startHours.length)];
      startDate.setHours(startHour, 0, 0, 0);

      // Set end date same day for 1 day booking (12hr period)
      const durationDays = Math.floor(Math.random() * 3) + 1;
      const endDate = new Date(startDate);
      if (durationDays > 1) {
        // For multi-day bookings, add full days
        endDate.setDate(startDate.getDate() + (durationDays - 1));
      }
      // Set end time to 12 hours after start time (e.g. 9am -> 9pm)
      endDate.setHours(startHour + 12, 0, 0, 0);

      return {
        carId: car.id,
        pickupLocation: "4 Lawrence Road, Ikoyi, Lagos",
        returnLocation: "4 Lawrence Road, Ikoyi, Lagos",
        specialRequests: "No special requests",
        startDate,
        endDate,
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        totalAmount: car.price * durationDays,
        userId: user.id,
      };
    });

    if (bookings.length > 0) {
      await prisma.booking.createMany({ data: bookings });
    }
  }

  console.info(`🚗 Cars have been successfully created.`);
  console.info(`🎭 User roles and permissions have been successfully created.`);
  console.info(`👤 Users have been successfully created.`);
  console.info(`🎫 Bookings have been successfully created.`);
}

try {
  const shouldRun = await shouldRunSeed();
  if (process.env.NODE_ENV === "production") {
    if (shouldRun) {
      await seed();
    } else {
      console.info("🌱 Seed already run. No migrations detected. Skipping...");
    }
  } else {
    await seed();
  }
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
