/** 3D-меши препятствий и объёма здания */

import * as THREE from 'three';
import { latLngToLocalMeters } from './calc.js';
import { OBSTACLE_COLORS, isCircularShape, migrateObstacle } from './obstacles.js';
import { roofSurfaceYAtPoint } from './roofMesh3d.js';

const BUILDING_COLOR = 0x64748b;
const BUILDING_EDGE = 0x475569;

function mat(color, roughness = 0.75) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.05,
    flatShading: true,
  });
}

function addTree(group, w, h, colors) {
  const trunkH = h * 0.45;
  const crownH = h * 0.55;
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.12, w * 0.16, trunkH, 10),
    mat(0x5c4033, 0.9),
  );
  trunk.position.y = trunkH / 2;
  group.add(trunk);

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(w / 2, crownH, 16),
    mat(colors.fill, 0.85),
  );
  crown.position.y = trunkH + crownH / 2;
  group.add(crown);
}

function addCone(group, w, h, colors) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(w / 2, h, 20),
    mat(colors.fill),
  );
  mesh.position.y = h / 2;
  group.add(mesh);
}

function addCylinder(group, w, h, colors) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(w / 2, w / 2, h, 20),
    mat(colors.fill),
  );
  mesh.position.y = h / 2;
  group.add(mesh);
}

function addCube(group, w, h, d, colors, rotationDeg) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat(colors.fill),
  );
  mesh.position.y = h / 2;
  mesh.rotation.y = (rotationDeg * Math.PI) / 180;
  group.add(mesh);
}

/** Объём здания от земли (y=0) до карниза (roofBaseHeightM) */
export function buildBuildingMesh(polyLocal, baseHeightM) {
  if (!polyLocal || polyLocal.length < 3 || baseHeightM <= 0.05) return null;

  const shape = new THREE.Shape();
  polyLocal.forEach((p, i) => {
    if (i === 0) shape.moveTo(p.x, -p.y);
    else shape.lineTo(p.x, -p.y);
  });
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: baseHeightM,
    bevelEnabled: false,
  });
  const mesh = new THREE.Mesh(
    geo,
    mat(BUILDING_COLOR, 0.88),
  );
  mesh.rotation.x = -Math.PI / 2;

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: BUILDING_EDGE, transparent: true, opacity: 0.35 }),
  );
  edges.rotation.x = -Math.PI / 2;

  const group = new THREE.Group();
  group.add(mesh);
  group.add(edges);
  return group;
}

export function buildObstacleMeshes3d(obstacles, {
  refLat,
  refLng,
  facets,
  roofEdges,
  pitchDeg,
  roofBaseHeightM,
  polyLocal,
}) {
  const root = new THREE.Group();
  if (!obstacles?.length || refLat == null) return root;

  obstacles.forEach((raw) => {
    const obs = migrateObstacle(raw);
    const local = latLngToLocalMeters(obs.lat, obs.lng, refLat, refLng);
    const baseY = roofSurfaceYAtPoint(
      local,
      facets,
      roofEdges || [],
      pitchDeg,
      roofBaseHeightM,
      polyLocal,
    );

    const colors = OBSTACLE_COLORS[obs.shape] || OBSTACLE_COLORS.tree;
    const item = new THREE.Group();
    item.position.set(local.x, baseY, local.y);

    const w = obs.widthM;
    const h = obs.heightM;
    const d = obs.lengthM;

    if (obs.shape === 'tree') addTree(item, w, h, colors);
    else if (obs.shape === 'cone') addCone(item, w, h, colors);
    else if (obs.shape === 'cylinder') addCylinder(item, w, h, colors);
    else if (isCircularShape(obs.shape)) addCylinder(item, w, h, colors);
    else addCube(item, w, h, d, colors, obs.rotationDeg || 0);

    root.add(item);
  });

  return root;
}

export function buildGroundPlane(sizeM) {
  const span = Math.max(sizeM, 20);
  const geo = new THREE.PlaneGeometry(span * 2, span * 2);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0.35,
    }),
  );
}
