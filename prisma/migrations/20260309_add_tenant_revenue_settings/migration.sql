-- Add tenant-level revenue settings for customizable dashboard revenue
ALTER TABLE "Tenant"
ADD COLUMN "revenueCurrency" TEXT NOT NULL DEFAULT 'USD',
ADD COLUMN "defaultAppointmentValue" DOUBLE PRECISION NOT NULL DEFAULT 200,
ADD COLUMN "pricingCatalog" JSONB;
