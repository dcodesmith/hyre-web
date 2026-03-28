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

type PublicPartnerWithLastmod = PublicPartner & {
  lastModifiedAt: Date;
};

type PartnerSitemapCandidate = {
  id: string;
  username: string | null;
  name: string | null;
  city: string | null;
  updatedAt: Date;
  cars: Array<{ updatedAt: Date }>;
  _count: { cars: number };
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

function buildExplicitUsernameSlugSet(candidates: PartnerSitemapCandidate[]): Set<string> {
  const usernameSlugs = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.username) continue;
    const normalizedUsernameSlug = normalizeSlug(candidate.username);
    if (!normalizedUsernameSlug) continue;
    usernameSlugs.add(normalizedUsernameSlug);
  }
  return usernameSlugs;
}

function getEligiblePartnerWhere() {
  return {
    fleetOwnerStatus: FleetOwnerStatus.APPROVED,
    hasOnboarded: true,
    cars: {
      some: {
        approvalStatus: CarApprovalStatus.APPROVED,
        status: { in: [Status.AVAILABLE, Status.BOOKED] },
      },
    },
  };
}

function buildFallbackSlugCounts(
  candidates: PartnerSitemapCandidate[],
  explicitUsernameSlugs: Set<string>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.username || !candidate.name) continue;
    const fallbackSlug = slugifyName(candidate.name);
    if (!fallbackSlug || explicitUsernameSlugs.has(fallbackSlug)) continue;
    counts.set(fallbackSlug, (counts.get(fallbackSlug) ?? 0) + 1);
  }
  return counts;
}

function toSitemapPublicPartner(
  candidate: PartnerSitemapCandidate,
  fallbackSlugCounts: Map<string, number>,
): PublicPartnerWithLastmod | null {
  const usernameSlug = candidate.username ? normalizeSlug(candidate.username) : null;
  const fallbackSlug = !usernameSlug && candidate.name ? slugifyName(candidate.name) : null;
  const resolvedSlug = usernameSlug ?? fallbackSlug;
  if (!resolvedSlug) return null;

  // Reserve explicit username slugs; do not assign them as fallback public slugs.
  if (!usernameSlug && !fallbackSlugCounts.has(resolvedSlug)) {
    return null;
  }

  // Skip ambiguous fallback slugs until dedicated stable public slug support lands.
  if (!usernameSlug && (fallbackSlugCounts.get(resolvedSlug) ?? 0) !== 1) {
    return null;
  }

  return {
    id: candidate.id,
    username: candidate.username,
    publicSlug: resolvedSlug,
    name: candidate.name,
    city: candidate.city,
    carsCount: candidate._count.cars,
    lastModifiedAt: candidate.cars[0]?.updatedAt ?? candidate.updatedAt,
  };
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
      ...getEligiblePartnerWhere(),
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
      ...getEligiblePartnerWhere(),
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

export async function listPublicPartnersForSitemap(): Promise<PublicPartnerWithLastmod[]> {
  const candidates: PartnerSitemapCandidate[] = await prisma.user.findMany({
    where: getEligiblePartnerWhere(),
    select: {
      id: true,
      username: true,
      name: true,
      city: true,
      updatedAt: true,
      cars: {
        where: {
          approvalStatus: CarApprovalStatus.APPROVED,
          status: { in: [Status.AVAILABLE, Status.BOOKED] },
        },
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      _count: {
        select: {
          cars: {
            where: {
              approvalStatus: CarApprovalStatus.APPROVED,
              status: { in: [Status.AVAILABLE, Status.BOOKED] },
            },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const explicitUsernameSlugs = buildExplicitUsernameSlugSet(candidates);
  const fallbackSlugCounts = buildFallbackSlugCounts(candidates, explicitUsernameSlugs);
  return candidates
    .map((candidate) => toSitemapPublicPartner(candidate, fallbackSlugCounts))
    .filter((partner): partner is PublicPartnerWithLastmod => Boolean(partner));
}
