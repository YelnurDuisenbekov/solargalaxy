/** Каталог оборудования для конструктора (упрощённая копия seed-каталога) */

export const MODULES = [
  { sku: 'LR8-66HVD-650M', name: 'LONGI Hi-Mo X10 650W', powerW: 650, widthM: 2.278, heightM: 1.134, price: 70000, voc: 48.5, isc: 16.8, vmp: 40.2, imp: 16.2 },
  { sku: 'LR7-72HVD-645M', name: 'Longi Hi-Mo X10 645W', powerW: 645, widthM: 2.278, heightM: 1.134, price: 75000, voc: 48.2, isc: 16.7, vmp: 40.0, imp: 16.1 },
  { sku: 'JINKO-625', name: 'Jinko Solar 625W', powerW: 625, widthM: 2.278, heightM: 1.134, price: 65000, voc: 47.8, isc: 16.5, vmp: 39.5, imp: 15.8 },
];

export const INVERTERS = [
  { sku: 'DEYE-10-P3', name: 'Deye 10 kW P3 on-grid', capacityKw: 10, price: 360000, type: 'on-grid', mpptCount: 2, maxStringsPerMppt: 2, vMpptMin: 200, vMpptMax: 1000, maxDcKw: 15, phases: 3 },
  { sku: 'DEYE-15', name: 'Deye 15 kW on-grid', capacityKw: 15, price: 487500, type: 'on-grid', mpptCount: 2, maxStringsPerMppt: 3, vMpptMin: 200, vMpptMax: 1000, maxDcKw: 22, phases: 3 },
  { sku: 'DEYE-20-OG', name: 'Deye 20 kW on-grid', capacityKw: 20, price: 525000, type: 'on-grid', mpptCount: 2, maxStringsPerMppt: 3, vMpptMin: 200, vMpptMax: 1000, maxDcKw: 30, phases: 3 },
  { sku: 'DEYE-HYB-20', name: 'Deye 20 kW hybrid', capacityKw: 20, price: 2025000, type: 'hybrid', mpptCount: 2, maxStringsPerMppt: 2, vMpptMin: 200, vMpptMax: 1000, maxDcKw: 26, phases: 3 },
];

export const CABLE_TYPES = [
  { id: 'pv-4', name: 'PV кабель 4 мм²', sectionMm2: 4, pricePerM: 780, maxAmp: 32 },
  { id: 'pv-6', name: 'PV кабель 6 мм²', sectionMm2: 6, pricePerM: 1100, maxAmp: 41 },
  { id: 'pv-10', name: 'PV кабель 10 мм²', sectionMm2: 10, pricePerM: 1800, maxAmp: 55 },
];

export const DEFAULT_MODULE = MODULES[0];
export const DEFAULT_INVERTER = INVERTERS[0];

export function findModule(sku) {
  return MODULES.find((m) => m.sku === sku) || DEFAULT_MODULE;
}

export function findInverter(sku) {
  return INVERTERS.find((i) => i.sku === sku) || DEFAULT_INVERTER;
}
