import { createServer, type IncomingMessage, type Server } from "node:http";

import { closeMockApiServer, listenOnMockApiPort } from "./mock-http-server";

export const MOCK_FLEET_CAR_ID = "cm12345678901234567890123";
export const MOCK_FLEET_DRAFT_CAR_ID = "cm62345678901234567890123";
export const MOCK_FLEET_IMAGE_ID = "cm32345678901234567890123";
export const MOCK_FLEET_DOCUMENT_ID = "cm42345678901234567890123";
export const MOCK_VEHICLE_VERIFICATION_ID = "cm72345678901234567890123";
const VEHICLE_VERIFICATION_DELAY_MS = 700;
const FLEET_FILE_REPLACEMENT_PATH = new RegExp(
  `^/api/fleet-owner/cars/${MOCK_FLEET_CAR_ID}/(images|documents)/([^/]+)/file$`,
);

const mockVerifiedOnboarding = {
  status: "VERIFIED",
  accountType: "INDIVIDUAL",
  isOwnerDriver: true,
  emailVerified: true,
  phone: { number: "**********5678", verified: true },
  identity: {
    status: "SUCCEEDED",
    legalName: "JOHN MIDDLE DOE",
    businessName: null,
  },
  bank: {
    bankName: "GTBank",
    accountName: "JOHN DOE",
    accountNumber: "******6789",
    verified: true,
  },
  documents: { driversLicense: "APPROVED", lasdri: "PENDING" },
  requiredActions: [],
  steps: {
    contact: "VERIFIED",
    identity: "VERIFIED",
    payout: "VERIFIED",
    driving: "COMPLETED",
    submission: "VERIFIED",
  },
  nextAction: "COMPLETE",
};

const mockLatestInsuranceVerification = {
  id: "cm52345678901234567890123",
  status: "SUCCEEDED",
  policyNumber: "POL-12345",
  policyStatus: "Active",
  policyExpiresAt: "2099-12-31T00:00:00.000Z",
  createdAt: "2026-09-07T12:00:00.000Z",
};

const mockVehicleVerification = {
  id: MOCK_VEHICLE_VERIFICATION_ID,
  status: "SUCCEEDED",
  vehicle: {
    plateNumber: "KJA123AB",
    chassisNumber: "1HGCM82633A004352",
    make: "Toyota",
    model: "Camry",
    year: 2020,
    color: "Black",
    passengerCapacity: 5,
  },
  eligibility: { isEligible: true, reasons: [] },
  expiresAt: "2026-09-08T12:00:00.000Z",
  carId: null as string | null,
};

const mockFleetCar = {
  id: MOCK_FLEET_CAR_ID,
  make: "Lexus",
  model: "RX 350",
  year: 2023,
  createdAt: "2026-08-01T10:00:00.000Z",
  updatedAt: "2026-08-20T10:00:00.000Z",
  color: "Black",
  ownerId: "owner-1",
  registrationNumber: "ABC123XY",
  status: "AVAILABLE",
  approvalStatus: "APPROVED",
  approvalNotes: null,
  submittedAt: "2026-09-07T12:00:00.000Z",
  hourlyRate: 10_000,
  dayRate: 80_000,
  nightRate: 60_000,
  fuelUpgradeRate: 20_000,
  fullDayRate: 150_000,
  airportPickupRate: 50_000,
  vehicleType: "SUV",
  serviceTier: "LUXURY",
  passengerCapacity: 4,
  pricingIncludesFuel: false,
  owner: {
    id: "owner-1",
    name: "Fleet Owner",
    username: null,
    email: "owner@example.com",
  },
  images: [
    {
      id: MOCK_FLEET_IMAGE_ID,
      url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
      status: "APPROVED",
      isPrimary: true,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-01T10:00:00.000Z",
    },
  ],
  documents: [
    {
      id: MOCK_FLEET_DOCUMENT_ID,
      documentType: "MOT_CERTIFICATE",
      status: "APPROVED",
      documentUrl: "https://cdn.example.com/mot.pdf",
      notes: null,
      approvedById: "admin-1",
      approvedAt: "2026-08-02T10:00:00.000Z",
      carId: MOCK_FLEET_CAR_ID,
      createdAt: "2026-08-01T10:00:00.000Z",
      updatedAt: "2026-08-02T10:00:00.000Z",
      userId: null,
    },
  ],
  insuranceVerifications: [mockLatestInsuranceVerification],
  promotion: null,
};

function hasCurrentInsurance(car: {
  insuranceVerifications: Array<{
    status: string;
    policyExpiresAt: string | null;
  }>;
}) {
  const verification = car.insuranceVerifications[0];
  return (
    verification?.status === "SUCCEEDED" &&
    verification.policyExpiresAt != null &&
    Date.parse(verification.policyExpiresAt) > Date.now()
  );
}

function hasDraftPricing(car: {
  airportPickupRate: number | null;
  dayRate: number | null;
  fuelUpgradeRate: number | null;
  fullDayRate: number | null;
  hourlyRate: number | null;
  nightRate: number | null;
  pricingIncludesFuel: boolean;
}) {
  return (
    car.hourlyRate != null &&
    car.dayRate != null &&
    car.nightRate != null &&
    car.fullDayRate != null &&
    car.airportPickupRate != null &&
    (car.pricingIncludesFuel || car.fuelUpgradeRate != null)
  );
}

function canSubmitDraftCar(car: ReturnType<typeof createMockDraftCar>) {
  return (
    car.documents.length >= 2 &&
    car.images.length >= 3 &&
    hasDraftPricing(car) &&
    hasCurrentInsurance(car)
  );
}

function draftDocument(id: string, documentType: "MOT_CERTIFICATE" | "INSURANCE_CERTIFICATE") {
  return {
    id,
    documentType,
    status: "PENDING" as const,
    documentUrl: `https://cdn.example.com/${id}.pdf`,
    notes: null,
    approvedById: null,
    approvedAt: null,
    carId: MOCK_FLEET_DRAFT_CAR_ID,
    createdAt: "2026-09-07T12:00:00.000Z",
    updatedAt: "2026-09-07T12:00:00.000Z",
    userId: null,
  };
}

function draftImage(index: number) {
  return {
    id: `cm0${index}345678901234567890123`,
    url: "https://images.unsplash.com/photo-1549399542-7e3f8b79c341",
    status: "PENDING" as const,
    isPrimary: index === 0,
    createdAt: "2026-09-07T12:00:00.000Z",
    updatedAt: "2026-09-07T12:00:00.000Z",
  };
}

function createMockDraftCar(plateNumber: string, policyNumber: string) {
  return {
    ...mockFleetCar,
    id: MOCK_FLEET_DRAFT_CAR_ID,
    make: "Toyota",
    model: "Camry",
    year: 2020,
    color: "Black",
    registrationNumber: plateNumber,
    status: "HOLD",
    approvalStatus: "PENDING",
    approvalNotes: null,
    submittedAt: null,
    hourlyRate: null,
    dayRate: null,
    nightRate: null,
    fuelUpgradeRate: null,
    fullDayRate: null,
    airportPickupRate: null,
    vehicleType: "SEDAN",
    serviceTier: "STANDARD",
    passengerCapacity: 5,
    images: [],
    documents: [],
    insuranceVerifications: [
      {
        ...mockLatestInsuranceVerification,
        policyNumber,
      },
    ],
    promotion: null,
  };
}

function createExpiredInsuranceDraft() {
  return {
    ...createMockDraftCar("KJA123AB", "POL-EXPIRED"),
    hourlyRate: 10_000,
    dayRate: 80_000,
    nightRate: 60_000,
    fuelUpgradeRate: 20_000,
    fullDayRate: 150_000,
    airportPickupRate: 50_000,
    documents: [
      draftDocument("cm82345678901234567890123", "MOT_CERTIFICATE"),
      draftDocument("cm92345678901234567890123", "INSURANCE_CERTIFICATE"),
    ],
    images: Array.from({ length: 3 }, (_, index) => draftImage(index)),
    insuranceVerifications: [
      {
        ...mockLatestInsuranceVerification,
        policyNumber: "POL-EXPIRED",
        policyStatus: "Expired",
        policyExpiresAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

const mockFleetCars = [
  mockFleetCar,
  {
    ...mockFleetCar,
    id: "cm22345678901234567890123",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    color: "Silver",
    registrationNumber: "KJA456AB",
    status: "HOLD",
    approvalStatus: "PENDING",
    approvalNotes: "Insurance certificate is under review.",
    hourlyRate: 8_000,
    dayRate: 65_000,
    nightRate: 50_000,
    fuelUpgradeRate: null,
    fullDayRate: 120_000,
    airportPickupRate: 40_000,
    vehicleType: "SEDAN",
    serviceTier: "STANDARD",
    images: [],
    documents: [],
  },
] as const;

const mockPayouts = Array.from({ length: 21 }, (_, index) => {
  const number = index + 1;
  const isProcessing = number === 1;

  return {
    id: `payout-${String(number).padStart(2, "0")}`,
    amountToPay: 40_000 + number * 1_000,
    amountPaid: isProcessing ? 0 : 39_500 + number * 1_000,
    currency: "NGN",
    status: isProcessing ? "PROCESSING" : "PAID_OUT",
    payoutProviderReference: isProcessing ? null : `provider-${number}`,
    initiatedAt: `2026-08-${String(number).padStart(2, "0")}T10:00:00.000Z`,
    processedAt: isProcessing ? null : `2026-08-${String(number).padStart(2, "0")}T11:00:00.000Z`,
    completedAt: isProcessing ? null : `2026-08-${String(number).padStart(2, "0")}T12:00:00.000Z`,
    notes: null,
    bookingId: `booking-${number}`,
    extensionId: null,
  };
});

const emptyPayoutStatus = { count: 0, amountToPay: 0, amountPaid: 0 };

const mockPayoutSummary = {
  totalPaidOut: 1_020_000,
  pendingPayouts: 41_000,
  failedPayouts: 0,
  lastPayoutAt: "2026-08-21T12:00:00.000Z",
  statusBreakdown: {
    PENDING_APPROVAL: emptyPayoutStatus,
    PENDING_DISBURSEMENT: emptyPayoutStatus,
    PROCESSING: { count: 1, amountToPay: 41_000, amountPaid: 0 },
    PAID_OUT: { count: 20, amountToPay: 1_030_000, amountPaid: 1_020_000 },
    FAILED: emptyPayoutStatus,
    REVERSED: emptyPayoutStatus,
  },
};

const mockDashboardOverview = {
  totalBookings: 18,
  completedBookings: 12,
  activeBookings: 4,
  cancelledBookings: 2,
  carsCount: 2,
  ownerDriverTrips: 7,
  chauffeurTrips: 5,
  totalEarnings: 920_000,
  pendingPayoutAmount: 80_000,
};

const mockDashboardEarnings = {
  range: {
    from: "2026-07-29T12:00:00.000Z",
    to: "2026-08-28T12:00:00.000Z",
    groupBy: "week",
  },
  totals: {
    gross: 600_000,
    net: 540_000,
    fees: 60_000,
    refunds: 0,
    rides: 8,
  },
  series: [
    {
      bucketStart: "2026-08-17T00:00:00.000Z",
      gross: 250_000,
      net: 225_000,
      fees: 25_000,
      refunds: 0,
      rides: 3,
    },
    {
      bucketStart: "2026-08-24T00:00:00.000Z",
      gross: 350_000,
      net: 315_000,
      fees: 35_000,
      refunds: 0,
      rides: 5,
    },
  ],
};

export type CapturedAuthRequest = {
  body: unknown;
  origin?: string;
  referer?: string;
};

export const MOCK_APPROVED_CHAUFFEUR_ID = "chauffeur-01";

type MockFleetChauffeur = {
  id: string;
  chauffeurId: string | null;
  name: string;
  email: string;
  phoneNumber: string;
  status: "INVITED" | "CONSENTED" | "PHONE_VERIFIED" | "IDENTITY_VERIFIED" | "APPROVED";
  isActive: boolean;
  image: string | null;
  invitedAt: string;
};

const mockFleetChauffeurs = Array.from({ length: 21 }, (_, index) => {
  const number = index + 1;
  const approved = number === 1;

  return {
    id: `invite-${String(number).padStart(2, "0")}`,
    chauffeurId: approved ? MOCK_APPROVED_CHAUFFEUR_ID : null,
    name: approved ? "Bola Adebayo" : `Chauffeur ${String(number).padStart(2, "0")}`,
    email: `chauffeur${number}@example.com`,
    phoneNumber: `+23480${String(10000000 + number).slice(-8)}`,
    status: approved ? "APPROVED" : "INVITED",
    isActive: approved,
    image: null,
    invitedAt: `2026-08-${String(Math.min(number, 28)).padStart(2, "0")}T12:00:00.000Z`,
  } satisfies MockFleetChauffeur;
});

export type MockFleetOwnerAuthApi = {
  server: Server;
  requests: {
    chauffeurInvitations: unknown[];
    chauffeurListQueries: Array<Record<string, string>>;
    chauffeurUpdates: Array<{ chauffeurId: string; body: unknown }>;
    createPromotions: unknown[];
    dashboardOverviewRequests: number;
    deactivatedPromotionIds: string[];
    draftCars: Array<{ verificationId: string }>;
    earningsQueries: Array<Record<string, string>>;
    fleetCarsRequests: number;
    fileReplacements: Array<{
      assetId: string;
      body: string;
      contentType?: string;
      kind: "image" | "document";
    }>;
    payoutQueries: Array<Record<string, string>>;
    payoutSummaryRequests: number;
    updateCars: Array<{ carId: string; body: unknown }>;
    vehicleVerifications: Array<{
      body: unknown;
      idempotencyKey?: string;
    }>;
    sendOtp?: CapturedAuthRequest;
    verifyOtp?: CapturedAuthRequest;
    signOut?: CapturedAuthRequest;
  };
};

function readJson(request: IncomingMessage) {
  return new Promise<unknown>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : null);
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readBody(request: IncomingMessage) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

function capturedRequest(request: IncomingMessage, body: unknown): CapturedAuthRequest {
  return {
    body,
    origin: request.headers.origin,
    referer: request.headers.referer,
  };
}

function writeJson(response: import("node:http").ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function handleFleetFileReplacement(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  replacementMatch: RegExpExecArray | null,
  requests: MockFleetOwnerAuthApi["requests"],
  fleetCar: typeof mockFleetCar,
) {
  if (request.method !== "PUT" || !replacementMatch) {
    return false;
  }

  const kind = replacementMatch[1] === "images" ? "image" : "document";
  const assetId = decodeURIComponent(replacementMatch[2]);
  const body = await readBody(request);
  requests.fileReplacements.push({
    assetId,
    body: body.toString("utf8"),
    contentType: request.headers["content-type"],
    kind,
  });

  if (kind === "image") {
    const image = fleetCar.images.find((item) => item.id === assetId);
    if (!image) {
      writeJson(response, 404, { status: 404, detail: "Vehicle image not found" });
      return true;
    }
    if (image.status !== "REJECTED") {
      writeJson(response, 400, { status: 400, detail: "Only rejected images can be replaced" });
      return true;
    }
    Object.assign(image, { status: "PENDING", updatedAt: "2026-08-28T13:00:00.000Z" });
    Object.assign(fleetCar, { approvalStatus: "PENDING" });
    writeJson(response, 200, { success: true, image });
    return true;
  }

  const document = fleetCar.documents.find((item) => item.id === assetId);
  if (!document) {
    writeJson(response, 404, { status: 404, detail: "Car document not found" });
    return true;
  }
  if (document.status !== "REJECTED") {
    writeJson(response, 400, { status: 400, detail: "Only rejected documents can be replaced" });
    return true;
  }
  Object.assign(document, {
    status: "PENDING",
    notes: null,
    updatedAt: "2026-08-28T13:00:00.000Z",
  });
  Object.assign(fleetCar, { approvalStatus: "PENDING" });
  writeJson(response, 200, { success: true, document });
  return true;
}

async function handleFleetCarsRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  fleetCar: typeof mockFleetCar,
) {
  const isList = path === "/api/fleet-owner/cars";
  const isDetail = path === `/api/fleet-owner/cars/${MOCK_FLEET_CAR_ID}`;
  const replacementMatch = FLEET_FILE_REPLACEMENT_PATH.exec(path);
  if (!isList && !isDetail && !replacementMatch) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (await handleFleetFileReplacement(request, response, replacementMatch, requests, fleetCar)) {
    return true;
  }

  if (request.method === "GET" && isList) {
    requests.fleetCarsRequests += 1;
    writeJson(response, 200, [fleetCar, mockFleetCars[1]]);
    return true;
  }

  if (request.method === "GET" && isDetail) {
    writeJson(response, 200, fleetCar);
    return true;
  }

  if (request.method === "PATCH" && isDetail) {
    const body = (await readJson(request)) as Partial<typeof mockFleetCar>;
    requests.updateCars.push({ carId: MOCK_FLEET_CAR_ID, body });
    Object.assign(fleetCar, body, { updatedAt: "2026-08-28T13:00:00.000Z" });
    writeJson(response, 200, fleetCar);
    return true;
  }

  return false;
}

type MockPromotion = Record<string, unknown> & {
  id: string;
  isActive: boolean;
};

async function handlePromotionsRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  promotions: MockPromotion[],
) {
  if (!path.startsWith("/api/fleet-owner/promotions")) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (path === "/api/fleet-owner/promotions" && request.method === "GET") {
    writeJson(response, 200, promotions);
    return true;
  }

  if (path === "/api/fleet-owner/promotions" && request.method === "POST") {
    const body = (await readJson(request)) as {
      name?: string;
      scope: "FLEET" | "CAR";
      carId?: string;
      discountValue: number;
      startDate: string;
      endDate: string;
    };
    requests.createPromotions.push(body);

    const endDate = new Date(`${body.endDate}T00:00:00+01:00`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const promotion = {
      id: `cm${String(promotions.length + 1).padStart(23, "0")}`,
      ownerId: "owner-1",
      carId: body.scope === "CAR" ? body.carId : null,
      name: body.name ?? null,
      discountValue: String(body.discountValue),
      startDate: new Date(`${body.startDate}T00:00:00+01:00`).toISOString(),
      endDate: endDate.toISOString(),
      isActive: true,
      createdAt: "2026-08-28T09:00:00.000Z",
      updatedAt: "2026-08-28T09:00:00.000Z",
      car:
        body.scope === "CAR"
          ? {
              id: MOCK_FLEET_CAR_ID,
              make: mockFleetCar.make,
              model: mockFleetCar.model,
              year: mockFleetCar.year,
              registrationNumber: mockFleetCar.registrationNumber,
            }
          : null,
    };
    promotions.push(promotion);
    const mutationResponse = { ...promotion };
    delete mutationResponse.car;
    writeJson(response, 201, mutationResponse);
    return true;
  }

  const deactivateMatch = /^\/api\/fleet-owner\/promotions\/([^/]+)\/deactivate$/.exec(path);
  if (request.method === "POST" && deactivateMatch) {
    const promotionId = decodeURIComponent(deactivateMatch[1]);
    const promotion = promotions.find((item) => item.id === promotionId);
    requests.deactivatedPromotionIds.push(promotionId);

    if (!promotion) {
      writeJson(response, 404, { status: 404, detail: "Promotion not found" });
      return true;
    }

    promotion.isActive = false;
    const mutationResponse = { ...promotion };
    delete mutationResponse.car;
    writeJson(response, 200, mutationResponse);
    return true;
  }

  return false;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const DRAFT_CAR_PATH = `/api/fleet-owner/cars/${MOCK_FLEET_DRAFT_CAR_ID}`;

type CarOnboardingState = {
  draftCar: ReturnType<typeof createMockDraftCar> | null;
  lastPolicyNumber: string;
  verification: typeof mockVehicleVerification;
};

async function handleDraftCarOnboardingMutation(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  state: CarOnboardingState,
) {
  if (!state.draftCar) {
    writeJson(response, 404, { status: 404, detail: "Car not found" });
    return true;
  }

  if (request.method === "POST" && path === `${DRAFT_CAR_PATH}/documents`) {
    await readBody(request);
    state.draftCar.documents = [
      draftDocument("cm82345678901234567890123", "MOT_CERTIFICATE"),
      draftDocument("cm92345678901234567890123", "INSURANCE_CERTIFICATE"),
    ];
    writeJson(response, 200, state.draftCar);
    return true;
  }

  if (request.method === "POST" && path === `${DRAFT_CAR_PATH}/images`) {
    await readBody(request);
    state.draftCar.images = Array.from({ length: 3 }, (_, index) => draftImage(index));
    writeJson(response, 200, state.draftCar);
    return true;
  }

  if (request.method === "PATCH" && path === `${DRAFT_CAR_PATH}/pricing`) {
    const body = (await readJson(request)) as Partial<ReturnType<typeof createMockDraftCar>>;
    Object.assign(state.draftCar, body, { updatedAt: "2026-09-07T13:00:00.000Z" });
    writeJson(response, 200, state.draftCar);
    return true;
  }

  if (request.method === "POST" && path === `${DRAFT_CAR_PATH}/insurance-verifications`) {
    const body = (await readJson(request)) as { policyNumber?: string };
    const verification = {
      id: "cm10345678901234567890123",
      status: "SUCCEEDED" as const,
      policyNumber: body.policyNumber ?? state.lastPolicyNumber,
      policyStatus: "Active",
      policyExpiresAt: "2099-12-31T00:00:00.000Z",
      createdAt: "2026-09-09T12:00:00.000Z",
    };
    state.lastPolicyNumber = verification.policyNumber;
    state.draftCar.insuranceVerifications = [verification];
    writeJson(response, 200, {
      ...verification,
      carId: MOCK_FLEET_DRAFT_CAR_ID,
      providerRef: "provider-1",
    });
    return true;
  }

  if (request.method === "POST" && path === `${DRAFT_CAR_PATH}/submissions`) {
    const hasDocuments = state.draftCar.documents.length >= 2;
    const hasImages = state.draftCar.images.length >= 3;
    const hasPricing = hasDraftPricing(state.draftCar);
    const hasInsuranceVerification = hasCurrentInsurance(state.draftCar);
    if (!canSubmitDraftCar(state.draftCar)) {
      writeJson(response, 400, {
        type: "FLEET_CAR_ONBOARDING_ERROR",
        title: "Car onboarding error",
        status: 400,
        detail: "Car is missing required documents, images, pricing, or insurance verification.",
        requirements: { hasDocuments, hasImages, hasPricing, hasInsuranceVerification },
      });
      return true;
    }
    state.draftCar.submittedAt = "2026-09-07T14:00:00.000Z";
    writeJson(response, 200, {
      success: true,
      requirements: {
        hasDocuments: true,
        hasImages: true,
        hasPricing: true,
        hasInsuranceVerification: true,
      },
    });
    return true;
  }

  return false;
}

async function handleVehicleVerificationRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  state: CarOnboardingState,
) {
  if (request.method === "POST" && path === "/api/fleet-owner/vehicle-verifications") {
    const body = (await readJson(request)) as {
      plateNumber?: string;
      policyNumber?: string;
    };
    requests.vehicleVerifications.push({
      body,
      idempotencyKey:
        typeof request.headers["idempotency-key"] === "string"
          ? request.headers["idempotency-key"]
          : undefined,
    });
    if (typeof body?.plateNumber === "string") {
      state.verification.vehicle.plateNumber = body.plateNumber;
    }
    if (typeof body?.policyNumber === "string") {
      state.lastPolicyNumber = body.policyNumber;
    }
    await wait(VEHICLE_VERIFICATION_DELAY_MS);
    writeJson(response, 200, state.verification);
    return true;
  }

  const verificationMatch = /^\/api\/fleet-owner\/vehicle-verifications\/([^/]+)$/.exec(path);
  if (request.method === "GET" && verificationMatch) {
    writeJson(response, 200, state.verification);
    return true;
  }

  return false;
}

function handleDraftCarCreation(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  state: CarOnboardingState,
) {
  const draftMatch = /^\/api\/fleet-owner\/vehicle-verifications\/([^/]+)\/car$/.exec(path);
  if (request.method !== "POST" || !draftMatch) {
    return false;
  }

  const verificationId = decodeURIComponent(draftMatch[1]);
  requests.draftCars.push({ verificationId });
  state.verification.carId = MOCK_FLEET_DRAFT_CAR_ID;
  state.draftCar = createMockDraftCar(
    state.verification.vehicle.plateNumber,
    state.lastPolicyNumber,
  );
  writeJson(response, 201, state.draftCar);
  return true;
}

async function handleCarOnboardingRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
  state: CarOnboardingState,
) {
  const isDraftCarApi = path === DRAFT_CAR_PATH || path.startsWith(`${DRAFT_CAR_PATH}/`);
  const isVehicleVerificationApi = path.startsWith("/api/fleet-owner/vehicle-verifications");
  if (!isDraftCarApi && !isVehicleVerificationApi) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (request.method === "GET" && path === DRAFT_CAR_PATH) {
    if (!state.draftCar) {
      writeJson(response, 404, { status: 404, detail: "Car not found" });
      return true;
    }
    writeJson(response, 200, state.draftCar);
    return true;
  }

  if (isDraftCarApi && (await handleDraftCarOnboardingMutation(request, response, path, state))) {
    return true;
  }

  if (await handleVehicleVerificationRequest(request, response, path, requests, state)) {
    return true;
  }

  if (handleDraftCarCreation(request, response, path, requests, state)) {
    return true;
  }

  return false;
}

const mockBanks = [
  { code: "058", name: "GTBank" },
  { code: "044", name: "Access Bank" },
];

const pendingOnboardingSteps = {
  contact: "PENDING",
  identity: "PENDING",
  payout: "PENDING",
  driving: "PENDING",
  submission: "PENDING",
} as const;

function createStagedOnboarding() {
  return {
    status: "ACTION_REQUIRED" as const,
    accountType: null as "INDIVIDUAL" | "BUSINESS" | null,
    isOwnerDriver: null as boolean | null,
    emailVerified: true,
    phone: { number: null as string | null, verified: false },
    identity: null as {
      status: "SUCCEEDED" | "REVIEW_REQUIRED";
      legalName: string | null;
      businessName: string | null;
    } | null,
    bank: null as {
      bankName: string;
      accountName: string;
      accountNumber: string;
      verified: boolean;
    } | null,
    documents: { driversLicense: null, lasdri: null },
    requiredActions: ["VERIFY_PHONE"] as Array<
      "VERIFY_EMAIL" | "VERIFY_PHONE" | "VERIFY_ACCOUNT" | "UPLOAD_DRIVERS_LICENSE"
    >,
    steps: { ...pendingOnboardingSteps },
    nextAction: "VERIFY_PHONE" as
      | "VERIFY_EMAIL"
      | "VERIFY_PHONE"
      | "VERIFY_IDENTITY"
      | "VERIFY_PAYOUT"
      | "PROVIDE_DRIVING_CREDENTIALS"
      | "SUBMIT_ACCOUNT"
      | "WAIT_FOR_REVIEW"
      | "COMPLETE",
  };
}

type StagedOnboarding = ReturnType<typeof createStagedOnboarding>;

function requireFleetOwnerSession(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
) {
  if (request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    return true;
  }
  writeJson(response, 401, { status: 401, detail: "Unauthorized" });
  return false;
}

async function handleStagedOnboardingRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  staged: StagedOnboarding,
) {
  switch (`${request.method} ${path}`) {
    case "GET /api/fleet-owner/banks":
      writeJson(response, 200, mockBanks);
      return true;
    case "POST /api/fleet-owner/phone-verifications": {
      const body = (await readJson(request)) as { phoneNumber?: string };
      staged.phone = { number: body.phoneNumber ?? "+2348012345678", verified: false };
      writeJson(response, 200, { status: "PENDING", phoneNumber: staged.phone.number });
      return true;
    }
    case "POST /api/fleet-owner/phone-verification-checks":
      staged.phone = { number: staged.phone.number ?? "+2348012345678", verified: true };
      staged.requiredActions = [];
      staged.steps.contact = "VERIFIED";
      staged.nextAction = "VERIFY_IDENTITY";
      writeJson(response, 200, { status: "VERIFIED", phoneNumber: staged.phone.number });
      return true;
    case "POST /api/fleet-owner/onboarding/identity-verifications": {
      const body = (await readJson(request)) as { accountType?: "INDIVIDUAL" | "BUSINESS" };
      staged.accountType = body.accountType ?? "INDIVIDUAL";
      staged.identity = {
        status: "SUCCEEDED",
        legalName: "JOHN MIDDLE DOE",
        businessName: staged.accountType === "BUSINESS" ? "HYRE MOBILITY LTD" : null,
      };
      staged.steps.identity = "VERIFIED";
      staged.nextAction = "VERIFY_PAYOUT";
      writeJson(response, 200, {
        id: "id-1",
        status: "VERIFIED",
        accountType: staged.accountType,
        legalName: staged.identity.legalName,
        businessName: staged.identity.businessName,
      });
      return true;
    }
    case "POST /api/fleet-owner/onboarding/payout-verifications": {
      const body = (await readJson(request)) as { bankName?: string; accountNumber?: string };
      staged.bank = {
        bankName: body.bankName ?? "GTBank",
        accountName: "JOHN DOE",
        accountNumber: "******6789",
        verified: false,
      };
      staged.steps.payout = "VERIFIED";
      staged.nextAction = "PROVIDE_DRIVING_CREDENTIALS";
      writeJson(response, 200, {
        status: "VERIFIED",
        bank: {
          bankName: staged.bank.bankName,
          accountName: staged.bank.accountName,
          accountNumber: staged.bank.accountNumber,
          nameMatch: "MATCHED",
        },
      });
      return true;
    }
    case "PUT /api/fleet-owner/onboarding/driving-credentials":
      await readBody(request);
      staged.isOwnerDriver = false;
      staged.steps.driving = "SKIPPED";
      staged.nextAction = "SUBMIT_ACCOUNT";
      writeJson(response, 200, {
        status: "COMPLETED",
        isOwnerDriver: false,
        documents: staged.documents,
      });
      return true;
    case "POST /api/fleet-owner/onboarding/submissions":
      staged.status = "UNDER_REVIEW";
      staged.steps.submission = "REVIEW_REQUIRED";
      staged.nextAction = "WAIT_FOR_REVIEW";
      writeJson(response, 200, {
        id: "ver-1",
        status: "REVIEW_REQUIRED",
        accountType: staged.accountType ?? "INDIVIDUAL",
        isOwnerDriver: staged.isOwnerDriver,
        legalName: staged.identity?.legalName ?? null,
        businessName: staged.identity?.businessName ?? null,
        bank: staged.bank
          ? {
              bankName: staged.bank.bankName,
              accountName: staged.bank.accountName,
              accountNumber: staged.bank.accountNumber,
              nameMatch: "MATCHED",
            }
          : null,
      });
      return true;
    default:
      return false;
  }
}

async function handleOnboardingRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  staged: StagedOnboarding | null,
  verifiedOnboarding: typeof mockVerifiedOnboarding,
) {
  const isOnboardingGet = path === "/api/fleet-owner/onboarding" && request.method === "GET";
  const isStagedPath =
    path === "/api/fleet-owner/banks" ||
    path === "/api/fleet-owner/phone-verifications" ||
    path === "/api/fleet-owner/phone-verification-checks" ||
    path.startsWith("/api/fleet-owner/onboarding/");

  if (!isOnboardingGet && !isStagedPath) {
    return false;
  }

  if (!requireFleetOwnerSession(request, response)) {
    return true;
  }

  if (isOnboardingGet) {
    writeJson(response, 200, staged ?? verifiedOnboarding);
    return true;
  }

  if (!staged) {
    return false;
  }

  return handleStagedOnboardingRequest(request, response, path, staged);
}

function handleDashboardPayoutsRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockFleetOwnerAuthApi["requests"],
) {
  if (!url.pathname.startsWith("/api/dashboard/payouts") || request.method !== "GET") {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (url.pathname === "/api/dashboard/payouts/summary") {
    requests.payoutSummaryRequests += 1;
    writeJson(response, 200, mockPayoutSummary);
    return true;
  }

  if (url.pathname !== "/api/dashboard/payouts") {
    return false;
  }

  requests.payoutQueries.push(Object.fromEntries(url.searchParams));
  const page = Number(url.searchParams.get("page") ?? 1);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const status = url.searchParams.get("status");
  const payouts = status ? mockPayouts.filter((payout) => payout.status === status) : mockPayouts;
  const start = (page - 1) * limit;

  writeJson(response, 200, {
    page,
    limit,
    total: payouts.length,
    items: payouts.slice(start, start + limit),
  });
  return true;
}

function handleDashboardRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockFleetOwnerAuthApi["requests"],
) {
  if (
    request.method !== "GET" ||
    (url.pathname !== "/api/dashboard/overview" && url.pathname !== "/api/dashboard/earnings")
  ) {
    return false;
  }

  if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
    return true;
  }

  if (url.pathname === "/api/dashboard/overview") {
    requests.dashboardOverviewRequests += 1;
    writeJson(response, 200, mockDashboardOverview);
    return true;
  }

  requests.earningsQueries.push(Object.fromEntries(url.searchParams));
  const groupBy = url.searchParams.get("groupBy") ?? "day";
  writeJson(response, 200, {
    ...mockDashboardEarnings,
    range: {
      ...mockDashboardEarnings.range,
      groupBy,
    },
    series:
      groupBy === "month"
        ? [{ bucketStart: "2026-08-01T00:00:00.000Z", ...mockDashboardEarnings.totals }]
        : mockDashboardEarnings.series,
  });
  return true;
}

async function handleFleetOwnerAuthRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  path: string,
  requests: MockFleetOwnerAuthApi["requests"],
) {
  if (request.method === "POST" && path === "/api/auth/email-otp/send-verification-otp") {
    requests.sendOtp = capturedRequest(request, await readJson(request));
    writeJson(response, 200, { success: true });
    return true;
  }

  if (request.method === "POST" && path === "/api/auth/sign-in/email-otp") {
    requests.verifyOtp = capturedRequest(request, await readJson(request));
    response.setHeader(
      "Set-Cookie",
      "better-auth.session_token=e2e-session; Path=/; HttpOnly; SameSite=Lax",
    );
    writeJson(response, 200, {
      user: {
        id: "owner-1",
        email: "owner@example.com",
        roles: ["fleetOwner"],
      },
    });
    return true;
  }

  if (request.method === "GET" && path === "/auth/session") {
    if (!request.headers.cookie?.includes("better-auth.session_token=e2e-session")) {
      writeJson(response, 401, { status: 401, detail: "Unauthorized" });
      return true;
    }

    writeJson(response, 200, {
      user: {
        id: "owner-1",
        email: "owner@example.com",
        name: "Fleet Owner",
        roles: ["fleetOwner"],
      },
      session: {},
    });
    return true;
  }

  if (request.method === "POST" && path === "/api/auth/sign-out") {
    requests.signOut = capturedRequest(request, await readJson(request));
    writeJson(response, 200, null);
    return true;
  }

  return false;
}

async function handleFleetChauffeursRequest(
  request: IncomingMessage,
  response: import("node:http").ServerResponse,
  url: URL,
  requests: MockFleetOwnerAuthApi["requests"],
  chauffeurs: MockFleetChauffeur[],
) {
  const path = url.pathname;
  const isList = path === "/api/fleet-owner/chauffeurs";
  const isInvite = path === "/api/fleet-owner/chauffeur-invitations";
  const updateMatch = /^\/api\/fleet-owner\/chauffeurs\/([^/]+)$/.exec(path);
  if (!isList && !isInvite && !updateMatch) {
    return false;
  }

  if (!requireFleetOwnerSession(request, response)) {
    return true;
  }

  if (request.method === "GET" && isList) {
    requests.chauffeurListQueries.push(Object.fromEntries(url.searchParams));
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const start = (page - 1) * limit;
    writeJson(response, 200, {
      items: chauffeurs.slice(start, start + limit),
      meta: {
        page,
        limit,
        total: chauffeurs.length,
        totalPages: Math.ceil(chauffeurs.length / limit),
      },
      complianceRequirements: [
        { type: "LASDRI", label: "LASDRI card", required: false },
        { type: "LASRRA", label: "LASRRA card", required: false },
        { type: "DRIVER_BADGE", label: "Lagos driver badge", required: false },
      ],
    });
    return true;
  }

  if (request.method === "POST" && isInvite) {
    const body = (await readJson(request)) as {
      name?: string;
      email?: string;
      phoneNumber?: string;
    };
    requests.chauffeurInvitations.push(body);
    const invited: MockFleetChauffeur = {
      id: `invite-${String(chauffeurs.length + 1).padStart(2, "0")}`,
      chauffeurId: null,
      name: body.name ?? "Invited chauffeur",
      email: body.email ?? "invited@example.com",
      phoneNumber: body.phoneNumber ?? "+2348099999999",
      status: "INVITED",
      isActive: false,
      image: null,
      invitedAt: "2026-09-11T12:00:00.000Z",
    };
    chauffeurs.unshift(invited);
    writeJson(response, 201, invited);
    return true;
  }

  if (request.method === "PATCH" && updateMatch) {
    const chauffeurId = decodeURIComponent(updateMatch[1]);
    const body = (await readJson(request)) as { isActive?: boolean };
    requests.chauffeurUpdates.push({ chauffeurId, body });
    const chauffeur = chauffeurs.find((item) => item.chauffeurId === chauffeurId);
    if (!chauffeur) {
      writeJson(response, 404, { status: 404, detail: "Chauffeur not found" });
      return true;
    }
    chauffeur.isActive = body.isActive === true;
    writeJson(response, 200, chauffeur);
    return true;
  }

  return false;
}

export async function startMockFleetOwnerAuthApi({
  port = 3100,
  rejectedFiles = false,
  stagedOnboarding = false,
  ineligibleVehicle = false,
  expiredInsuranceDraft = false,
  ownerDriver = true,
}: {
  readonly port?: number;
  readonly rejectedFiles?: boolean;
  readonly stagedOnboarding?: boolean;
  readonly ineligibleVehicle?: boolean;
  readonly expiredInsuranceDraft?: boolean;
  readonly ownerDriver?: boolean;
} = {}) {
  const requests: MockFleetOwnerAuthApi["requests"] = {
    chauffeurInvitations: [],
    chauffeurListQueries: [],
    chauffeurUpdates: [],
    createPromotions: [],
    dashboardOverviewRequests: 0,
    deactivatedPromotionIds: [],
    draftCars: [],
    earningsQueries: [],
    fleetCarsRequests: 0,
    fileReplacements: [],
    payoutQueries: [],
    payoutSummaryRequests: 0,
    updateCars: [],
    vehicleVerifications: [],
  };
  const promotions: MockPromotion[] = [];
  const fleetCar = structuredClone(mockFleetCar);
  const onboardingState = {
    draftCar: expiredInsuranceDraft ? createExpiredInsuranceDraft() : null,
    lastPolicyNumber: expiredInsuranceDraft
      ? "POL-EXPIRED"
      : mockLatestInsuranceVerification.policyNumber,
    verification: structuredClone(mockVehicleVerification),
  };
  if (ineligibleVehicle) {
    Object.assign(onboardingState.verification.vehicle, { year: 2014 });
    Object.assign(onboardingState.verification.eligibility, {
      isEligible: false,
      reasons: ["VEHICLE_YEAR_BELOW_MINIMUM"],
    });
  }
  const stagedOwnerOnboarding = stagedOnboarding ? createStagedOnboarding() : null;
  const verifiedOnboarding = { ...mockVerifiedOnboarding, isOwnerDriver: ownerDriver };
  const chauffeurs = ownerDriver ? [] : mockFleetChauffeurs.map((item) => ({ ...item }));
  if (rejectedFiles) {
    Object.assign(fleetCar, {
      approvalStatus: "REJECTED",
      approvalNotes: "Upload clearer files so this car can be reviewed again.",
    });
    Object.assign(fleetCar.images[0], { status: "REJECTED" });
    Object.assign(fleetCar.documents[0], {
      status: "REJECTED",
      notes: "The certificate scan is blurry.",
    });
  }
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;

    if (await handleFleetOwnerAuthRequest(request, response, path, requests)) {
      return;
    }

    if (
      await handleOnboardingRequest(
        request,
        response,
        path,
        stagedOwnerOnboarding,
        verifiedOnboarding,
      )
    ) {
      return;
    }

    if (await handleFleetChauffeursRequest(request, response, url, requests, chauffeurs)) {
      return;
    }

    if (await handleCarOnboardingRequest(request, response, path, requests, onboardingState)) {
      return;
    }

    if (await handleFleetCarsRequest(request, response, path, requests, fleetCar)) {
      return;
    }

    if (await handlePromotionsRequest(request, response, path, requests, promotions)) {
      return;
    }

    if (handleDashboardPayoutsRequest(request, response, url, requests)) {
      return;
    }

    if (handleDashboardRequest(request, response, url, requests)) {
      return;
    }

    writeJson(response, 401, { status: 401, detail: "Unauthorized" });
  });

  await listenOnMockApiPort(server, port);
  return { server, requests };
}

export function stopMockFleetOwnerAuthApi(api: MockFleetOwnerAuthApi) {
  return closeMockApiServer(api.server);
}
