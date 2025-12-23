-- CreateEnum
CREATE TYPE "FlightStatus" AS ENUM ('SCHEDULED', 'DEPARTED', 'IN_AIR', 'DELAYED', 'ARRIVED', 'CANCELLED', 'DIVERTED');

-- CreateEnum
CREATE TYPE "FlightDataSource" AS ENUM ('FLIGHTAWARE', 'MANUAL', 'CACHED');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "flightId" TEXT;

-- CreateTable
CREATE TABLE "Flight" (
    "id" TEXT NOT NULL,
    "flightNumber" TEXT NOT NULL,
    "flightDate" DATE NOT NULL,
    "faFlightId" TEXT,
    "originCode" TEXT NOT NULL,
    "originCodeIATA" TEXT,
    "originName" TEXT,
    "originCity" TEXT,
    "destinationCode" TEXT NOT NULL,
    "destinationCodeIATA" TEXT,
    "destinationName" TEXT,
    "destinationCity" TEXT,
    "scheduledDeparture" TIMESTAMP(3),
    "scheduledArrival" TIMESTAMP(3) NOT NULL,
    "estimatedDeparture" TIMESTAMP(3),
    "estimatedArrival" TIMESTAMP(3),
    "actualDeparture" TIMESTAMP(3),
    "actualArrival" TIMESTAMP(3),
    "status" "FlightStatus" NOT NULL DEFAULT 'SCHEDULED',
    "delayMinutes" INTEGER,
    "aircraftType" TEXT,
    "registration" TEXT,
    "departureGate" TEXT,
    "arrivalGate" TEXT,
    "alertId" TEXT,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT false,
    "alertCreatedAt" TIMESTAMP(3),
    "alertDisabledAt" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataSource" "FlightDataSource" NOT NULL DEFAULT 'FLIGHTAWARE',
    "isLive" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Flight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlightStatusEvent" (
    "id" TEXT NOT NULL,
    "flightId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventTime" TIMESTAMP(3) NOT NULL,
    "eventData" JSONB NOT NULL,
    "oldStatus" "FlightStatus",
    "newStatus" "FlightStatus",
    "delayChange" INTEGER,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "notificationsSent" BOOLEAN NOT NULL DEFAULT false,
    "notifiedUserIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlightStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Flight_alertId_key" ON "Flight"("alertId");

-- CreateIndex
CREATE INDEX "Flight_flightNumber_flightDate_idx" ON "Flight"("flightNumber", "flightDate");

-- CreateIndex
CREATE INDEX "Flight_status_idx" ON "Flight"("status");

-- CreateIndex
CREATE INDEX "Flight_alertId_idx" ON "Flight"("alertId");

-- CreateIndex
CREATE INDEX "Flight_destinationCodeIATA_flightDate_idx" ON "Flight"("destinationCodeIATA", "flightDate");

-- CreateIndex
CREATE INDEX "Flight_scheduledArrival_idx" ON "Flight"("scheduledArrival");

-- CreateIndex
CREATE UNIQUE INDEX "Flight_flightNumber_flightDate_key" ON "Flight"("flightNumber", "flightDate");

-- CreateIndex
CREATE INDEX "FlightStatusEvent_flightId_eventTime_idx" ON "FlightStatusEvent"("flightId", "eventTime");

-- CreateIndex
CREATE INDEX "FlightStatusEvent_eventType_idx" ON "FlightStatusEvent"("eventType");

-- CreateIndex
CREATE INDEX "FlightStatusEvent_processed_idx" ON "FlightStatusEvent"("processed");

-- CreateIndex
CREATE INDEX "Booking_flightId_idx" ON "Booking"("flightId");

-- AddForeignKey
ALTER TABLE "FlightStatusEvent" ADD CONSTRAINT "FlightStatusEvent_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_flightId_fkey" FOREIGN KEY ("flightId") REFERENCES "Flight"("id") ON DELETE SET NULL ON UPDATE CASCADE;
