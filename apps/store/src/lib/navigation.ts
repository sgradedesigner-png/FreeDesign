// Navigation configuration for DTF/UV/Blanks mega-menu
// Phase 1: Start-Order funnel and merchandising structure

export type NavItemType = {
  label: { mn: string; en: string };
  href: string;
  description?: { mn: string; en: string };
  badge?: string;
};

export type NavGroupType = {
  title: { mn: string; en: string };
  items: NavItemType[];
};

export const megaMenuConfig: NavGroupType[] = [
  {
    title: { mn: 'DTF Transfers', en: 'DTF Transfers' },
    items: [
      {
        label: { mn: 'Хэмжээгээр', en: 'By Size' },
        href: '/collections/dtf-by-size',
        description: {
          mn: 'Стандарт хэмжээний DTF transfer',
          en: 'Standard size DTF transfers',
        },
      },
      {
        label: { mn: 'Gang Sheet (Upload)', en: 'Gang Sheet (Upload)' },
        href: '/collections/dtf-gang-upload',
        description: {
          mn: 'Бэлэн файл upload хийх',
          en: 'Upload ready-to-print file',
        },
      },
      {
        label: { mn: 'Gang Sheet (Builder)', en: 'Gang Sheet (Builder)' },
        href: '/collections/dtf-gang-builder',
        description: {
          mn: 'Онлайн байршуулалт хийх',
          en: 'Online gang sheet builder',
        },
        badge: 'MVP',
      },
    ],
  },
  {
    title: { mn: 'UV DTF', en: 'UV DTF' },
    items: [
      {
        label: { mn: 'Хэмжээгээр', en: 'By Size' },
        href: '/collections/uv-by-size',
        description: {
          mn: 'UV DTF хэмжээний бүтээгдэхүүн',
          en: 'UV DTF size-based products',
        },
      },
      {
        label: { mn: 'Gang Sheet (Upload)', en: 'Gang Sheet (Upload)' },
        href: '/collections/uv-gang-upload',
        description: {
          mn: 'UV gang sheet файл оруулах',
          en: 'Upload UV gang sheet file',
        },
      },
      {
        label: { mn: 'Gang Sheet (Builder)', en: 'Gang Sheet (Builder)' },
        href: '/collections/uv-gang-builder',
        description: {
          mn: 'UV gang sheet builder',
          en: 'UV gang sheet builder',
        },
        badge: 'MVP',
      },
    ],
  },
  {
    title: { mn: 'Blanks', en: 'Blanks' },
    items: [
      {
        label: { mn: 'Бүх blanks', en: 'All Blanks' },
        href: '/collections/blanks',
        description: {
          mn: 'Цамц, hoodie, sweatshirt',
          en: 'T-shirts, hoodies, sweatshirts',
        },
      },
    ],
  },
  {
    title: { mn: 'Тусламж', en: 'Support' },
    items: [
      {
        label: { mn: 'Түгээмэл асуулт', en: 'FAQ' },
        href: '/pages/faq',
        description: {
          mn: 'Байнга асуух асуултууд',
          en: 'Frequently asked questions',
        },
      },
      {
        label: { mn: 'Хүргэлтийн мэдээлэл', en: 'Shipping Info' },
        href: '/pages/shipping',
        description: {
          mn: 'Хүргэлтийн нөхцөл',
          en: 'Shipping terms and conditions',
        },
      },
      {
        label: { mn: 'Файл шаардлага', en: 'Artwork Requirements' },
        href: '/pages/art-requirements',
        description: {
          mn: 'Файлын техникийн шаардлага',
          en: 'Technical requirements for artwork',
        },
      },
    ],
  },
];

// Quick access links for start-order page
export const startOrderCards: NavItemType[] = [
  {
    label: { mn: 'DTF Transfer (Хэмжээгээр)', en: 'DTF Transfers (By Size)' },
    href: '/collections/dtf-by-size',
    description: {
      mn: 'Хэмжээ сонгоод захиалга эхлүүлнэ.',
      en: 'Pick a size and start your order.',
    },
  },
  {
    label: { mn: 'DTF Gang Sheet (Upload)', en: 'DTF Gang Sheet (Upload)' },
    href: '/collections/dtf-gang-upload',
    description: {
      mn: 'Бэлэн файлаа оруулаад үргэлжлүүлнэ.',
      en: 'Upload a ready-to-print file.',
    },
  },
  {
    label: { mn: 'DTF Gang Sheet (Builder)', en: 'DTF Gang Sheet (Builder)' },
    href: '/collections/dtf-gang-builder',
    description: {
      mn: 'Онлайнаар байршуулж бэлтгэнэ.',
      en: 'Build a sheet online (MVP).',
    },
  },
  {
    label: { mn: 'UV DTF (Хэмжээгээр)', en: 'UV DTF (By Size)' },
    href: '/collections/uv-by-size',
    description: {
      mn: 'UV transfer бүтээгдэхүүнүүд.',
      en: 'UV transfer products.',
    },
  },
  {
    label: { mn: 'Blanks', en: 'Blanks' },
    href: '/collections/blanks',
    description: {
      mn: 'Цамц, hoodie, sweatshirt зэрэг.',
      en: 'T-shirts, hoodies, sweatshirts, and more.',
    },
  },
];
