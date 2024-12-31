import fs from "node:fs/promises";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { Status } from "@prisma/client";
import { uploadImageToS3 } from "~/services/s3.server";
import { vehicles } from "~/vehicles";
import { prisma } from "../app/modules/db/db.server";

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

async function seed() {
  // Clear database in a single transaction
  await prisma.$transaction(async (transaction) => {
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

  await prisma.user.create({
    select: { id: true },
    data: {
      email: "dcodesmith@gmail.com",
      username: "dcodesmith",
      name: "Damola Kolawole",
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
      price: [90000, 100000, 110000, 120000, 130000][Math.floor(Math.random() * 5)],
      color: ["Blue", "Silver", "Black", "White"][Math.floor(Math.random() * 4)],
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
      })} ${faker.helpers.arrayElement(["AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH"])}`,
    }));

    const createdCars = await prisma.car.createManyAndReturn({
      data: cars,
    });

    for (const car of createdCars) {
      const formattedMake = car.make.toLowerCase().replace(/\s+/g, "-");
      const formattedModel = car.model.toLowerCase().replace(/\s+/g, "-");
      const basePattern = `${formattedMake}-${formattedModel}`;
      const carImages = await getCarImages(basePattern);

      const imageUrls = await Promise.all(carImages.map((image) => uploadImageToS3(image, car)));

      if (imageUrls.length > 0) {
        await prisma.car.update({
          where: { id: car.id },
          data: { images: imageUrls, status: Status.AVAILABLE },
        });
      }
    }
  }

  console.info("🚗 Cars have been successfully created.");
  console.info("🎭 User roles and permissions have been successfully created.");
  console.info("👤 Users have been successfully created.");
}

try {
  await seed();
} catch (error) {
  console.error(error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
