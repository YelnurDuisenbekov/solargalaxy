/** Сборка Three.js-группы крыши, препятствий и панелей для конструктора */

import * as THREE from 'three';
import { buildRoofSurfaceData } from './roofMesh3d.js';
import { buildBuildingMesh, buildGroundPlane, buildObstacleMeshes3d } from './obstacleMesh3d.js';
import { buildPanelMeshes3d } from './panelMesh3d.js';
import { migrateObstacles } from './obstacles.js';

export function disposeObject(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
}

/**
 * @param {object} opts
 * @param {boolean} [opts.showGround=true] — земля под зданием (в overlay на карте лучше false)
 */
export function buildConstructorSceneGroup({
  roofPolygon,
  roofEdges,
  pitchDeg,
  azimuthDeg,
  facetAzimuthOverrides,
  roofBaseHeightM,
  obstacles,
  panels,
  module,
  panelsVisible3d,
  panelMountMode,
  panelMountTiltDeg,
  panelLayout,
  selectedFacetId,
  selectedObstacleId = null,
  showGround = true,
}) {
  if (!roofPolygon || roofPolygon.length < 3) return null;

  const data = buildRoofSurfaceData(
    roofPolygon,
    roofEdges,
    Number(pitchDeg),
    azimuthDeg,
    Number(roofBaseHeightM) || 0,
    facetAzimuthOverrides || {},
  );
  if (!data) return null;

  const sceneGroup = new THREE.Group();

  if (showGround) {
    const groundSpan = Math.max(
      ...data.polyLocal.map((p) => Math.hypot(p.x - data.cx, p.y - data.cz)),
      8,
    );
    sceneGroup.add(buildGroundPlane(groundSpan * 1.8));
  }

  const building = buildBuildingMesh(data.polyLocal, data.roofBaseHeightM);
  if (building) sceneGroup.add(building);

  if (data.solidVertices?.length >= 9) {
    const solidGeo = new THREE.BufferGeometry();
    solidGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.solidVertices, 3));
    solidGeo.setAttribute('normal', new THREE.Float32BufferAttribute(data.solidNormals, 3));
    solidGeo.computeBoundingSphere();
    sceneGroup.add(new THREE.Mesh(
      solidGeo,
      new THREE.MeshStandardMaterial({
        color: 0x4a5568,
        roughness: 0.9,
        metalness: 0.02,
        flatShading: true,
      }),
    ));
  }

  const roofGroup = new THREE.Group();

  if (data.facetGroups?.length > 0) {
    data.facetGroups.forEach((fg) => {
      const facetMeta = data.facets?.find((f) => f.id === fg.id);
      const isActive = facetMeta?.active !== false;
      const isSelected = selectedFacetId === fg.id;
      const byteStart = fg.startIndex * 3;
      const byteCount = fg.count * 3;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices.slice(byteStart, byteStart + byteCount), 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals.slice(byteStart, byteStart + byteCount), 3));
      geo.computeBoundingSphere();
      let color = fg.color;
      if (isSelected) color = 0xc9a227;
      else if (!isActive) color = 0x94a3b8;
      const mesh = new THREE.Mesh(
        geo,
        new THREE.MeshStandardMaterial({
          color,
          roughness: 0.82,
          metalness: isSelected ? 0.12 : 0.05,
          flatShading: true,
          transparent: !isActive,
          opacity: !isActive ? 0.38 : 1,
          depthWrite: isActive,
          emissive: isSelected ? 0x5c4a14 : 0x000000,
          emissiveIntensity: isSelected ? 0.35 : 0,
        }),
      );
      mesh.userData.pickRole = 'roof';
      roofGroup.add(mesh);
    });
  } else if (data.vertices.length >= 9) {
    const roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(data.vertices, 3));
    roofGeo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    roofGeo.computeBoundingSphere();
    const roofMesh = new THREE.Mesh(
      roofGeo,
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.82,
        metalness: 0.05,
        flatShading: true,
      }),
    );
    roofMesh.userData.pickRole = 'roof';
    roofGroup.add(roofMesh);
  }

  data.ridgeLines.forEach((line) => {
    const dir = new THREE.Vector3(line.to.x - line.from.x, line.to.y - line.from.y, line.to.z - line.from.z);
    const len = dir.length();
    if (len < 0.05) return;
    const rib = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.16, 0.22),
      new THREE.MeshStandardMaterial({ color: 0x103b5e, roughness: 0.45 }),
    );
    rib.position.set(
      (line.from.x + line.to.x) / 2,
      (line.from.y + line.to.y) / 2 + 0.06,
      (line.from.z + line.to.z) / 2,
    );
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    roofGroup.add(rib);
  });

  sceneGroup.add(roofGroup);

  const obsGroup = buildObstacleMeshes3d(migrateObstacles(obstacles), {
    refLat: data.refLat,
    refLng: data.refLng,
    facets: data.facets,
    roofEdges,
    pitchDeg: Number(pitchDeg),
    roofBaseHeightM: data.roofBaseHeightM,
    polyLocal: data.polyLocal,
    selectedObstacleId,
  });
  sceneGroup.add(obsGroup);

  const pickRoofMeshes = roofGroup.children.filter((c) => c.isMesh && c.userData.pickRole === 'roof');
  const pickObstacleMeshes = obsGroup.children.slice();

  if (panelsVisible3d && panels?.length && module) {
    const panelGroup = buildPanelMeshes3d(panels, {
      module,
      mountMode: panelMountMode || 'racked',
      panelLayout: panelLayout || 'horizontal',
      mountTiltDeg: panelMountTiltDeg ?? 30,
      facets: data.facets,
      roofEdges,
      pitchDeg: Number(pitchDeg),
      roofBaseHeightM: data.roofBaseHeightM,
      polyLocal: data.polyLocal,
    });
    sceneGroup.add(panelGroup);
  }

  return {
    group: sceneGroup,
    data,
    pickRoofMeshes,
    pickObstacleMeshes,
    meshInfo: {
      facets: data.facetGroups?.length || 0,
      maxH: Math.round(data.maxHeight * 10) / 10,
      baseH: Math.round((data.roofBaseHeightM || 0) * 10) / 10,
      obsCount: (obstacles || []).length,
      panelCount: panelsVisible3d ? (panels?.filter((p) => p.active).length || 0) : 0,
    },
  };
}
