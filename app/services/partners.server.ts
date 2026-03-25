import { CarApprovalStatus, FleetOwnerStatus, Status } from "@prisma/client";
import { prisma } from "~/modules/db/db.server";

export type PublicPartner = {
  id: string;
  username: string | null;
  publicSlug: string;
  name: string | null;
  city: string | null;
  carsCount: number;
};

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function slugifyName(name: string): string {
  return name
    .normalize("NFKD")
    .replaceAll(/\p{M}+/gu, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export async function getPublicPartnerBySlug(slug: string): Promise<PublicPartner | null> {
  const normalizedSlug = normalizeSlug(slug);
  if (!normalizedSlug) return null;

  const usernameOwner = await prisma.user.findUnique({
    where: { username: normalizedSlug },
    select: { id: true },
  });

  const partner = await prisma.user.findFirst({
    where: {
      username: normalizedSlug,
      fleetOwnerStatus: FleetOwnerStatus.APPROVED,
      hasOnboarded: true,
      cars: {
        some: {
          approvalStatus: CarApprovalStatus.APPROVED,
          status: { in: [Status.AVAILABLE, Status.BOOKED] },
        },
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      city: true,
    },
  });

  if (partner?.username) {
    const carsCount = await prisma.car.count({
      where: {
        ownerId: partner.id,
        approvalStatus: CarApprovalStatus.APPROVED,
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
      },
    });

    return {
      id: partner.id,
      username: partner.username,
      publicSlug: normalizeSlug(partner.username),
      name: partner.name,
      city: partner.city,
      carsCount,
    };
  }

  // Reserve explicit username slugs; do not fall back to name-derived matching.
  if (usernameOwner) return null;

  const fallbackCandidates = await prisma.user.findMany({
    where: {
      username: null,
      name: { not: null },
      fleetOwnerStatus: FleetOwnerStatus.APPROVED,
      hasOnboarded: true,
      cars: {
        some: {
          approvalStatus: CarApprovalStatus.APPROVED,
          status: { in: [Status.AVAILABLE, Status.BOOKED] },
        },
      },
    },
    select: {
      id: true,
      username: true,
      name: true,
      city: true,
    },
  });

  const matches = fallbackCandidates.filter(
    (candidate): candidate is typeof candidate & { name: string } =>
      typeof candidate.name === "string" && slugifyName(candidate.name) === normalizedSlug,
  );

  // Refuse ambiguous name-derived slugs until dedicated publicSlug support lands.
  if (matches.length !== 1) return null;

  const match = matches[0];
  const carsCount = await prisma.car.count({
    where: {
      ownerId: match.id,
      approvalStatus: CarApprovalStatus.APPROVED,
      status: { in: [Status.AVAILABLE, Status.BOOKED] },
    },
  });

  return {
    id: match.id,
    username: match.username,
    publicSlug: normalizedSlug,
    name: match.name,
    city: match.city,
    carsCount,
  };
}
