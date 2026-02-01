// src/config/printZones.js
// ✅ REACT руу шилжүүлсэн

// Print zone dimensions in centimeters
export const ZONE_CM = {
  tshirt: {
    front: { width: 30, height: 40 },
    back: { width: 30, height: 40 },
    left_arm: { width: 10, height: 15 },
    right_arm: { width: 10, height: 15 }
  },
  tumbler: {
    wrap: { width: 25, height: 10 }
  }
};

// Rotation correction per zone (in radians)
export const ZONE_ROTATION_CORRECTION = {
  front: 0,
  back: Math.PI, // 180° rotation
  left_arm: 0,
  right_arm: 0
};