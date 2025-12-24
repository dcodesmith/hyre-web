-- Populate vehicle tiers for existing cars based on make/model patterns
-- This migration categorizes cars into appropriate VehicleType and ServiceTier
-- Note: TRIM(LOWER(...)) handles both case sensitivity and whitespace

-- ============================================================================
-- ULTRA-LUXURY SUVs (₦400k+/day tier)
-- ============================================================================

-- Mercedes-Benz G-Class (G-Wagon) - Top tier luxury SUV
UPDATE "Car" 
SET "vehicleType" = 'LUXURY_SUV', 
    "serviceTier" = 'ULTRA_LUXURY',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'mercedes-benz' AND TRIM(LOWER(model)) LIKE '%g-class%';

-- ============================================================================
-- LUXURY SUVs (₦150k-300k/day tier)
-- ============================================================================

-- Land Rover Defender
UPDATE "Car" 
SET "vehicleType" = 'LUXURY_SUV', 
    "serviceTier" = 'LUXURY',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'land rover' AND TRIM(LOWER(model)) LIKE '%defender%';

-- Land Rover Range Rover Sport
UPDATE "Car" 
SET "vehicleType" = 'LUXURY_SUV', 
    "serviceTier" = 'LUXURY',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'land rover' AND TRIM(LOWER(model)) LIKE '%range rover sport%';

-- Lexus LX 600
UPDATE "Car" 
SET "vehicleType" = 'LUXURY_SUV', 
    "serviceTier" = 'LUXURY',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'lexus' AND TRIM(LOWER(model)) LIKE '%lx%';

-- Toyota Land Cruiser 300 (excluding Prado which is handled separately)
UPDATE "Car" 
SET "vehicleType" = 'LUXURY_SUV', 
    "serviceTier" = 'LUXURY',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'toyota' 
  AND TRIM(LOWER(model)) LIKE '%land cruiser%'
  AND TRIM(LOWER(model)) NOT LIKE '%prado%';

-- ============================================================================
-- EXECUTIVE SUVs (₦60k-100k/day tier)
-- ============================================================================

-- Land Rover Range Rover Velar (entry-level Range Rover)
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'land rover' AND TRIM(LOWER(model)) LIKE '%velar%';

-- Lexus RX 350
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'lexus' AND TRIM(LOWER(model)) LIKE '%rx%';

-- Lexus GX 460
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'lexus' AND TRIM(LOWER(model)) LIKE '%gx%';

-- Toyota Highlander
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'toyota' AND TRIM(LOWER(model)) LIKE '%highlander%';

-- Audi Q7
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'audi' AND TRIM(LOWER(model)) LIKE '%q7%';

-- Toyota Prado (Land Cruiser Prado export name)
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'toyota' AND TRIM(LOWER(model)) LIKE '%prado%';

-- ============================================================================
-- STANDARD SUVs (₦30k-50k/day tier)
-- ============================================================================

-- Mitsubishi Pajero
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'STANDARD',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'mitsubishi' AND TRIM(LOWER(model)) LIKE '%pajero%';

-- Honda Pilot
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'STANDARD',
    "passengerCapacity" = 7
WHERE TRIM(LOWER(make)) = 'honda' AND TRIM(LOWER(model)) LIKE '%pilot%';

-- ============================================================================
-- CATCH-ALL: Any remaining cars with luxury brand names
-- These set all three fields to ensure consistent data
-- ============================================================================

-- Remaining Land Rover models not yet categorized (assume SUV)
UPDATE "Car" 
SET "vehicleType" = 'SUV', 
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'land rover' 
  AND "serviceTier" = 'STANDARD';

-- Remaining Lexus models not yet categorized (assume SUV)
UPDATE "Car" 
SET "vehicleType" = 'SUV',
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'lexus' 
  AND "serviceTier" = 'STANDARD';

-- Remaining Audi models not yet categorized (assume SUV)
UPDATE "Car" 
SET "vehicleType" = 'SUV',
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'audi' 
  AND "serviceTier" = 'STANDARD';

-- Remaining BMW models not yet categorized (assume sedan)
UPDATE "Car" 
SET "vehicleType" = 'SEDAN',
    "serviceTier" = 'EXECUTIVE',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'bmw' 
  AND "serviceTier" = 'STANDARD';

-- Remaining Porsche models not yet categorized (assume SUV like Cayenne/Macan)
UPDATE "Car" 
SET "vehicleType" = 'SUV',
    "serviceTier" = 'LUXURY',
    "passengerCapacity" = 5
WHERE TRIM(LOWER(make)) = 'porsche' 
  AND "serviceTier" = 'STANDARD';
