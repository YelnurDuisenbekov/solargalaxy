/** 3D-меши солнечных панелей на крыше */

import * as THREE from 'three';
import { findModule } from './equipment.js';
import { roofSurfaceYAtPoint } from './roofMesh3d.js';

const PANEL_THICKNESS_M = 0.035;
const SURFACE_GAP_M = 0.01;
const RAIL_H_M = 0.04;
const RAIL_W_M = 0.05;
const LEG_W_M = 0.05;

const PANEL_COLOR = 0x0d1b3e;
const PANEL_FRAME = 0x263238;
const RAIL_COLOR = 0xb0bec5;
const LEG_COLOR = 0x78909c;

function mat(color, { roughness = 0.45, metalness = 0.15, opacity = 1, transparent = false } = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    opacity,
    transparent,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    flatShading: false,
  });
}

function roofYAt(mapX, mapY, ctx) {
  return roofSurfaceYAtPoint(
    { x: mapX, y: mapY },
    ctx.facets,
    ctx.roofEdges,
    ctx.pitchDeg,
    ctx.roofBaseHeightM,
    ctx.polyLocal,
  );
}

/**
 * Локальная система ската в точке панели.
 * Нормаль и касательные — по градиенту roofSurfaceYAtPoint (тот же источник, что у меша крыши).
 */
function buildRoofFrame(mapX, mapY, ctx, eps = 0.25) {
  const y0 = roofYAt(mapX, mapY, ctx);
  const yx = roofYAt(mapX + eps, mapY, ctx);
  const yz = roofYAt(mapX, mapY + eps, ctx);
  const gradX = (yx - y0) / eps;
  const gradZ = (yz - y0) / eps;

  const normal = new THREE.Vector3(-gradX, 1, -gradZ).normalize();

  // В плане: grad указывает вверх по скату → downSlope противоположен
  let downSlope = new THREE.Vector3(-gradX, 0, -gradZ);
  if (downSlope.lengthSq() < 1e-10) downSlope.set(0, 0, 1);
  downSlope.normalize();
  downSlope.projectOnPlane(normal).normalize();

  const crossSlope = new THREE.Vector3().crossVectors(downSlope, normal).normalize();

  const roofPitchDeg = THREE.MathUtils.radToDeg(
    Math.asin(Math.min(1, Math.hypot(gradX, gradZ))),
  );

  return {
    position: new THREE.Vector3(mapX, y0, mapY),
    normal,
    downSlope,
    crossSlope,
    roofPitchDeg,
  };
}

function buildPanelBasis(frame, panelLayout) {
  const { normal, downSlope, crossSlope } = frame;
  const vertical = panelLayout === 'vertical' || panelLayout === 'along';

  // width = локальная X панели, depth = локальная Z, normal = локальная Y
  const widthDir = vertical ? downSlope.clone() : crossSlope.clone();
  let depthDir = vertical ? crossSlope.clone() : downSlope.clone();

  // Правильный ортонормированный базис: depth = width × normal
  depthDir = new THREE.Vector3().crossVectors(widthDir, normal).normalize();
  const widthOrtho = new THREE.Vector3().crossVectors(normal, depthDir).normalize();

  const roofQuat = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(widthOrtho, normal, depthDir),
  );

  return { roofQuat, widthDir: widthOrtho, depthDir, normal };
}

function buildRackQuat(frame, basis, mountMode, tiltDeg) {
  const mode = mountMode === 'flush' ? 'surface' : mountMode;
  if (mode !== 'racked') {
    return new THREE.Quaternion();
  }

  const targetRad = THREE.MathUtils.degToRad(Number(tiltDeg) || 0);
  const roofPitchRad = THREE.MathUtils.degToRad(frame.roofPitchDeg || 0);
  const extraRad = Math.max(0, targetRad - roofPitchRad);
  if (extraRad < 1e-6) return new THREE.Quaternion();

  const { normal, crossSlope } = frame;
  const downHoriz = new THREE.Vector3(frame.downSlope.x, 0, frame.downSlope.z).normalize();
  const qPlus = new THREE.Quaternion().setFromAxisAngle(crossSlope, extraRad);
  const qMinus = new THREE.Quaternion().setFromAxisAngle(crossSlope, -extraRad);
  const nPlus = normal.clone().applyQuaternion(qPlus);
  const nMinus = normal.clone().applyQuaternion(qMinus);
  const rackWorld = nPlus.dot(downHoriz) >= nMinus.dot(downHoriz) ? qPlus : qMinus;

  return basis.roofQuat.clone().invert().multiply(rackWorld).multiply(basis.roofQuat);
}

/**
 * Сдвигает сборку вдоль нормали так, чтобы все контактные точки
 * нижней плоскости лежали на кровле + clearance (в мм зазора).
 */
function settleOnRoof(position, roofQuat, normal, ctx, contactLocals, clearanceM) {
  const ny = Math.max(normal.y, 0.12);
  let shift = 0;

  contactLocals.forEach((lp) => {
    const offset = lp.clone().applyQuaternion(roofQuat);
    const wx = position.x + offset.x;
    const wz = position.z + offset.z;
    const roofY = roofYAt(wx, wz, ctx);
    const currentY = position.y + offset.y;
    const need = (roofY + clearanceM - currentY) / ny;
    if (need > shift) shift = need;
  });

  if (shift > 0) {
    position.addScaledVector(normal, shift);
  }
}

function bottomContacts(halfW, halfD, gapM) {
  return [
    new THREE.Vector3(-halfW, gapM, -halfD),
    new THREE.Vector3(halfW, gapM, -halfD),
    new THREE.Vector3(-halfW, gapM, halfD),
    new THREE.Vector3(halfW, gapM, halfD),
  ];
}

function addPanelFace(group, widthM, heightM, active, bottomY) {
  const yPos = bottomY + PANEL_THICKNESS_M / 2;
  const panelMat = mat(active ? PANEL_COLOR : 0x64748b, {
    opacity: active ? 1 : 0.45,
    transparent: !active,
  });

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(widthM, PANEL_THICKNESS_M, heightM),
    panelMat,
  );
  panel.position.y = yPos;
  group.add(panel);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(widthM + 0.02, 0.01, heightM + 0.02),
    mat(PANEL_FRAME, { roughness: 0.6, metalness: 0.25 }),
  );
  frame.position.y = bottomY + 0.005;
  group.add(frame);
}

function addSurfacePanel(group, widthM, heightM, active) {
  addPanelFace(group, widthM, heightM, active, SURFACE_GAP_M);
}

function addRackedPanel(group, widthM, heightM, active, rackQuat) {
  const legMat = mat(LEG_COLOR, { roughness: 0.5, metalness: 0.35 });
  const railMat = mat(RAIL_COLOR, { roughness: 0.35, metalness: 0.55 });

  const hw = widthM / 2;
  const hd = heightM / 2;
  const railZ = hd * 0.4;

  const tiltGroup = new THREE.Group();
  tiltGroup.quaternion.copy(rackQuat);
  group.add(tiltGroup);

  const panelBottom = RAIL_H_M;
  addPanelFace(tiltGroup, widthM, heightM, active, panelBottom);

  [-railZ, railZ].forEach((z) => {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(widthM * 0.96, RAIL_H_M, RAIL_W_M),
      railMat,
    );
    rail.position.set(0, RAIL_H_M / 2, z);
    tiltGroup.add(rail);
  });

  // Ножки вертикально по скату (локальная Y), от кровли до рельса
  [-railZ, railZ].forEach((z) => {
    [-hw, hw].forEach((x) => {
      const railPt = new THREE.Vector3(x, RAIL_H_M, z).applyQuaternion(rackQuat);
      const legH = Math.max(0.02, railPt.y);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(LEG_W_M, legH, LEG_W_M), legMat);
      leg.position.set(railPt.x, legH / 2, railPt.z);
      group.add(leg);
    });
  });
}

export function computeRoofFrameAt(local, ctx) {
  return buildRoofFrame(local.x, local.y, ctx);
}

export function buildPanelMeshes3d(panels, {
  module,
  mountMode = 'racked',
  panelLayout = 'horizontal',
  mountTiltDeg = 30,
  facets,
  roofEdges,
  pitchDeg,
  roofBaseHeightM,
  polyLocal,
}) {
  const root = new THREE.Group();
  if (!panels?.length || !module) return root;

  const mode = mountMode === 'flush' ? 'surface' : mountMode;
  const layout = panelLayout === 'vertical' || panelLayout === 'along' ? 'vertical' : 'horizontal';
  const ctx = {
    facets: facets || [],
    roofEdges: roofEdges || [],
    pitchDeg: Number(pitchDeg) || 0,
    roofBaseHeightM: Number(roofBaseHeightM) || 0,
    polyLocal,
  };

  panels.forEach((p) => {
    const mapX = p.localX;
    const mapY = p.localY;
    if (mapX == null || mapY == null) return;

    const mod = findModule(p.moduleSku || module.sku);
    const longM = mod.widthM;
    const shortM = mod.heightM;
    const halfW = longM / 2;
    const halfD = shortM / 2;

    const frame = buildRoofFrame(mapX, mapY, ctx);
    const basis = buildPanelBasis(frame, layout);
    const rackQuat = buildRackQuat(frame, basis, mode, mountTiltDeg);

    const item = new THREE.Group();
    item.position.copy(frame.position);
    item.quaternion.copy(basis.roofQuat);

    if (mode === 'surface') {
      const contacts = bottomContacts(halfW, halfD, 0);
      settleOnRoof(item.position, basis.roofQuat, frame.normal, ctx, contacts, SURFACE_GAP_M);
      addSurfacePanel(item, longM, shortM, p.active);
    } else {
      const railZ = halfD * 0.4;
      const footContacts = [];
      [-railZ, railZ].forEach((z) => {
        [-halfW, halfW].forEach((x) => {
          footContacts.push(new THREE.Vector3(x, 0, z).applyQuaternion(rackQuat));
        });
      });
      settleOnRoof(item.position, basis.roofQuat, frame.normal, ctx, footContacts, 0);
      addRackedPanel(item, longM, shortM, p.active, rackQuat);
    }

    root.add(item);
  });

  return root;
}
