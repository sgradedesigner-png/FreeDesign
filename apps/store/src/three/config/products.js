// src/config/products.js
// ✅ REACT руу шилжүүлсэн

export const PRODUCTS = {
  tshirt: {
    id: 'tshirt',
    name: 'T-Shirt',
    modelPath: '/assets/models/Tshirt/TShirt.glb',
    printZones: ['front', 'back', 'left_arm', 'right_arm'],
    baseColor: '#1f6feb'
  },
  tumbler: {
    id: 'tumbler',
    name: 'Tumbler',
    modelPath: '/assets/models/Tshirt/Tumbler.glb',
    printZones: ['wrap'],
    baseColor: '#ffffff'
  }
};

// Zone mesh names in 3D model
export const ZONE_MESH_NAMES = {
  front: 'PRINT_ZONE_FRONT',
  back: 'PRINT_ZONE_BACK',
  left_arm: 'PRINT_ZONE_LEFT_ARM',
  right_arm: 'PRINT_ZONE_RIGHT_ARM'
};