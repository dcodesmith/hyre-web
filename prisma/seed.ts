import fs from "node:fs/promises";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { DocumentStatus, DocumentType, Status } from "@prisma/client";
import { uploadFileToS3 } from "../app/services/s3.server";
import { vehicles } from "../app/vehicles";
import { prisma } from "../app/modules/db/db.server";
import logger from "../app/lib/logger.server";

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

async function getDocument(fileName: string) {
  try {
    const documentDir = path.join(process.cwd(), "public", "documents");
    const filePath = path.join(documentDir, fileName);
    const buffer = await fs.readFile(filePath);
    const extname = path.extname(fileName).slice(1);
    const mimeType = extname === "pdf" ? "application/pdf" : `image/${extname}`;
    return new File([buffer], fileName, { type: mimeType });
  } catch (error) {
    console.warn(`Error loading document ${fileName}:`, error);
  }
}

export async function seed() {
  // Clear database in a single transaction
  await prisma.$transaction(async (transaction) => {
    // Delete in correct order to handle foreign key constraints
    await transaction.booking.deleteMany();
    await transaction.vehicleImage.deleteMany();
    await transaction.documentApproval.deleteMany();
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
      email: "admin@dcodesmith.com",
      username: "admin",
      name: "Oga Agba",
      roles: { connect: [{ name: "admin" }, { name: "user" }] },
    },
  });

  const fleetOwners = [
    {
      name: "Cool FleetOwner",
      email: "cool.fleetowner@dcodesmith.com",
    },
    {
      name: "Nerdy FleetOwner",
      email: "nerdy.fleetowner@dcodesmith.com",
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

      const ninFile = await getDocument("nin.png");
      const drivingLicenseFile = await getDocument("drivers_licence.png");

      const createdChauffeur = await prisma.user.create({
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

      // Create document approvals directly
      await prisma.documentApproval.createMany({
        data: [
          {
            documentType: DocumentType.NIN,
            documentUrl: ninFile
              ? await uploadFileToS3(
                  ninFile,
                  `${createdFleetOwner.id}/${createdChauffeur.id}-${ninFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
                )
              : "",
            status: DocumentStatus.PENDING,
            userId: createdChauffeur.id,
          },
          {
            documentType: DocumentType.DRIVERS_LICENSE,
            documentUrl: drivingLicenseFile
              ? await uploadFileToS3(
                  drivingLicenseFile,
                  `${createdFleetOwner.id}/${createdChauffeur.id}-${drivingLicenseFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
                )
              : "",
            status: DocumentStatus.PENDING,
            userId: createdChauffeur.id,
          },
        ],
      });
    }

    const data = vehicles.map((vehicle) => ({
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
      data,
    });

    for (const car of createdCars) {
      const formattedMake = car.make.toLowerCase().replace(/\s+/g, "-");
      const formattedModel = car.model.toLowerCase().replace(/\s+/g, "-");
      const basePattern = `${formattedMake}-${formattedModel}`;
      const carImages = await getCarImages(basePattern);

      const timestamp = Date.now();

      const imagesUrl = await Promise.all(
        carImages.map((image) => {
          const safeFilename = `${timestamp}-${image.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
          const key = `${car.ownerId}/${car.id}-${safeFilename}`;

          return uploadFileToS3(image, key);
        }),
      );

      // Create vehicle images
      if (imagesUrl.length > 0) {
        await prisma.vehicleImage.createMany({
          data: imagesUrl.map((url) => ({
            url,
            carId: car.id,
          })),
        });
      }

      const motCertificateFile = await getDocument("mot.pdf");
      const insuranceCertificateFile = await getDocument("insurance.pdf");
      const motCertificateUrl = await uploadFileToS3(
        motCertificateFile!,
        `${car.ownerId}/${car.id}-${timestamp}-${motCertificateFile?.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
      );
      const insuranceCertificateUrl = await uploadFileToS3(
        insuranceCertificateFile!,
        `${car.ownerId}/${car.id}-${timestamp}-${insuranceCertificateFile?.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`,
      );

      // Create document approvals for MOT and Insurance
      await prisma.documentApproval.createMany({
        data: [
          {
            documentType: DocumentType.MOT_CERTIFICATE,
            documentUrl: motCertificateUrl,
            carId: car.id,
            status: DocumentStatus.PENDING,
          },
          {
            documentType: DocumentType.INSURANCE_CERTIFICATE,
            documentUrl: insuranceCertificateUrl,
            carId: car.id,
            status: DocumentStatus.PENDING,
          },
        ],
      });

      const response = await prisma.car.update({
        where: { id: car.id },
        data: {
          status: Status.AVAILABLE,
        },
        include: {
          documents: true,
          images: true,
        },
      });
    }
  }

  logger.info("🚗 Cars have been successfully created.");
  logger.info("🎭 User roles and permissions have been successfully created.");
  logger.info("👤 Users have been successfully created.");
}

try {
  await seed();
} catch (error) {
  console.error("Detailed seed error:", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
