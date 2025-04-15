import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Migrate chauffeur documents
  const chauffeurs = await prisma.user.findMany({
    where: {
      OR: [{ ninUrl: { not: null } }, { drivingLicenceUrl: { not: null } }],
      roles: {
        some: {
          name: "chauffeur",
        },
      },
    },
    select: {
      id: true,
      ninUrl: true,
      drivingLicenceUrl: true,
    },
  });

  for (const chauffeur of chauffeurs) {
    if (chauffeur.ninUrl) {
      await prisma.documentApproval.create({
        data: {
          documentType: "NIN",
          documentUrl: chauffeur.ninUrl,
          chauffeurId: chauffeur.id,
          status: "PENDING",
        },
      });
    }

    if (chauffeur.drivingLicenceUrl) {
      await prisma.documentApproval.create({
        data: {
          documentType: "DRIVERS_LICENSE",
          documentUrl: chauffeur.drivingLicenceUrl,
          chauffeurId: chauffeur.id,
          status: "PENDING",
        },
      });
    }
  }

  // Migrate car documents
  const cars = await prisma.car.findMany({
    where: {
      OR: [{ motCertificateUrl: { not: null } }, { insuranceCertificateUrl: { not: null } }],
    },
    select: {
      id: true,
      motCertificateUrl: true,
      insuranceCertificateUrl: true,
    },
  });

  for (const car of cars) {
    if (car.motCertificateUrl) {
      await prisma.documentApproval.create({
        data: {
          documentType: "MOT_CERTIFICATE",
          documentUrl: car.motCertificateUrl,
          carId: car.id,
          status: "PENDING",
        },
      });
    }

    if (car.insuranceCertificateUrl) {
      await prisma.documentApproval.create({
        data: {
          documentType: "INSURANCE_CERTIFICATE",
          documentUrl: car.insuranceCertificateUrl,
          carId: car.id,
          status: "PENDING",
        },
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
