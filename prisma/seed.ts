import fs from "node:fs/promises";
import path from "node:path";
import { faker } from "@faker-js/faker";
import { AddonType, DocumentStatus, DocumentType, PlatformFeeType, Status } from "@prisma/client";
import { uploadFileToS3 } from "../app/services/s3.server";
import { vehicles } from "../app/data/vehicles";
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

const cleanUp = async () => {
  await prisma.$transaction(async (transaction) => {
    // Delete in correct order to handle foreign key constraints
    await transaction.extension.deleteMany();
    await transaction.bookingLeg.deleteMany();
    await transaction.booking.deleteMany();
    await transaction.vehicleImage.deleteMany();
    await transaction.documentApproval.deleteMany();
    await transaction.car.deleteMany();
    await transaction.payoutTransaction.deleteMany();
    await transaction.payment.deleteMany();
    await transaction.bankDetails.deleteMany();
    await transaction.user.deleteMany();
    await transaction.role.deleteMany();
    await transaction.taxRate.deleteMany();
    await transaction.platformFeeRate.deleteMany();
    await transaction.addonRate.deleteMany();
  });
};

export async function seed() {
  await cleanUp();

  /**
   * Users and Roles.
   */
  await prisma.role.create({
    data: {
      name: "admin",
      description: "Administrator with full system access",
    },
  });

  await prisma.role.create({
    data: {
      name: "staff",
      description: "Staff member with document, car, and chauffeur approval permissions",
    },
  });

  await prisma.role.create({
    data: {
      name: "fleetOwner",
      description: "Fleet owner who can manage cars and chauffeurs",
    },
  });

  await prisma.role.create({
    data: {
      name: "chauffeur",
      description: "Chauffeur who can drive cars",
    },
  });

  await prisma.role.create({
    data: {
      name: "user",
      description: "Regular user who can book cars",
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

  logger.info("🎭 User roles have been successfully created.");

  if (process.env.NODE_ENV === "development") {
    await prisma.taxRate.create({
      data: {
        ratePercent: 7.5,
        effectiveSince: new Date(),
        effectiveUntil: null,
        description: "VAT",
      },
    });

    await prisma.platformFeeRate.create({
      data: {
        feeType: PlatformFeeType.PLATFORM_SERVICE_FEE,
        ratePercent: 0,
        effectiveSince: new Date(),
        effectiveUntil: null,
        description: "Platform service fee",
      },
    });

    await prisma.platformFeeRate.create({
      data: {
        feeType: PlatformFeeType.FLEET_OWNER_COMMISSION,
        ratePercent: 0,
        effectiveSince: new Date(),
        effectiveUntil: null,
        description: "Fleet owner commission",
      },
    });

    await prisma.addonRate.create({
      data: {
        addonType: AddonType.SECURITY_DETAIL,
        rateAmount: 30000,
        effectiveSince: new Date(),
        effectiveUntil: null,
        description: "Security detail service per day",
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

    const chauffeurEmails = [
      "calm.chauffeur@dcodesmith.com",
      "happy.chauffeur@dcodesmith.com",
      "jolly.chauffeur@dcodesmith.com",
      "moody.chauffeur@dcodesmith.com",
      "stern.chauffeur@dcodesmith.com",
      "jovial.chauffeur@dcodesmith.com",
      "fun.chauffeur@dcodesmith.com",
      "hungry.chauffeur@dcodesmith.com",
      "stable.chauffeur@dcodesmith.com",
      "funky.chauffeur@dcodesmith.com",
    ];

    let index = -1;

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
        index++;
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();

        const ninFile = await getDocument("nin.png");
        const drivingLicenseFile = await getDocument("drivers_licence.png");

        const createdChauffeur = await prisma.user.create({
          select: { id: true },
          data: {
            email: chauffeurEmails[index],
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
        dayRate: faker.helpers.arrayElement([1000, 1100, 1200, 1300, 1400]),
        fullDayRate: faker.helpers.arrayElement([2000, 2100, 2200, 2300, 2400]),
        color: faker.helpers.arrayElement(["Blue", "Silver", "Black", "White"]),
        year: faker.helpers.arrayElement([
          2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024,
        ]),
        hourlyRate: faker.helpers.arrayElement([80, 100, 120, 140]),
        nightRate: faker.helpers.arrayElement([800, 850, 900]),
        fuelUpgradeRate: faker.helpers.arrayElement([1500, 1800, 2000, 2200, 2500]),
        status: faker.helpers.arrayElement(Object.values(Status)),
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

        await prisma.car.update({
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
    logger.info("👤 Users have been successfully created.");
    logger.info("💰 Tax rates have been successfully created.");
    logger.info("💰 Platform fee rates have been successfully created.");
  }
}

try {
  await seed();
} catch (error) {
  console.error("Detailed seed error:", error);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
