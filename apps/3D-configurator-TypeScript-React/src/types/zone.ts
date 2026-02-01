// src/types/zone.ts

/** Zone keys for T-shirt */
export type ZoneKey = 'front' | 'back' | 'left_arm' | 'right_arm';

/** Product types */
export type ProductType = 'tshirt' | 'hoodie' | 'cap';

/** UV outline point */
export interface UVPoint {
  u: number;
  v: number;
}

/** Print zone rectangle in UV coordinates */
export interface ZoneRect {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  outline: UVPoint[] | null;
  blockerOutline?: UVPoint[] | null;
  name: string;
  side: ZoneKey;
  correctionRad: number;
}

/** Print zone dimensions in centimeters */
export interface ZoneCM {
  width: number;
  height: number;
}

/** Safe margins in centimeters */
export interface SafeMargin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/** Zone configuration per product */
export type ProductZoneCM = Partial<Record<ZoneKey, ZoneCM>>;

/** All products zone configuration */
export type AllProductZoneCM = Record<ProductType, ProductZoneCM>;

/** Safe margins per zone */
export type ZoneSafeMargins = Record<ZoneKey, SafeMargin>;
