// src/config/printZones.ts
import type { AllProductZoneCM, ZoneKey, ZoneCM } from '../types/zone';

/** Print zone dimensions in centimeters for each product type */
export const ZONE_CM: AllProductZoneCM = {
  tshirt: {
    front:     { width: 30, height: 40 },
    back:      { width: 30, height: 40 },
    left_arm:  { width: 10, height: 12 },
    right_arm: { width: 10, height: 12 },
  },
  hoodie: {
    front: { width: 30, height: 40 },
  },
  cap: {
    front: { width: 14, height: 8 },
  },
};

/** Get zone dimensions for a specific product and zone */
export function getZoneCM(product: keyof typeof ZONE_CM, zone: ZoneKey): ZoneCM | undefined {
  return ZONE_CM[product]?.[zone];
}

/** Get all available zones for a product */
export function getProductZones(product: keyof typeof ZONE_CM): ZoneKey[] {
  const zones = ZONE_CM[product];
  return zones ? (Object.keys(zones) as ZoneKey[]) : [];
}
