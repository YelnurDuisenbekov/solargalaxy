import { useEffect, useRef, useState } from 'react';

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { edgeToLocal, getPolygonRef, toLocalPolygon } from '../../utils/constructor/roofFacets.js';



function disposeObject(obj) {

  obj.traverse((child) => {

    if (child.geometry) child.geometry.dispose();

    if (child.material) {

      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());

      else child.material.dispose();

    }

  });

}



function polygonCentroid(points) {

  if (!points.length) return { x: 0, y: 0 };

  const x = points.reduce((s, p) => s + p.x, 0) / points.length;

  const y = points.reduce((s, p) => s + p.y, 0) / points.length;

  return { x, y };

}



function buildShapeGeometry(polygon, cx, cy) {

  const shape = new THREE.Shape();

  polygon.forEach((p, i) => {

    const x = p.x - cx;

    const z = p.y - cy;

    if (i === 0) shape.moveTo(x, z);

    else shape.lineTo(x, z);

  });

  shape.closePath();

  const geo = new THREE.ShapeGeometry(shape);

  geo.rotateX(-Math.PI / 2);

  return geo;

}



function createTiltGroup(cx, cy, pitchDeg, azimuthDeg) {

  const group = new THREE.Group();

  group.position.set(cx, 0, cy);

  group.rotation.order = 'YXZ';

  group.rotation.y = (azimuthDeg * Math.PI) / 180;

  group.rotation.x = -(pitchDeg * Math.PI) / 180;

  return group;

}



export default function Constructor3D({

  roofPolygon,

  roofEdges,

  facets,

  pitchDeg,

  azimuthDeg,

  moduleWidthM,

  moduleHeightM,

  activePanels,

  selectedPanelId,

  hasRoof,

}) {

  const wrapRef = useRef(null);

  const engineRef = useRef(null);

  const [ready, setReady] = useState(false);



  useEffect(() => {

    const wrap = wrapRef.current;

    if (!wrap) return undefined;



    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x0f172a);



    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 800);

    camera.position.set(12, 9, 14);



    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    renderer.domElement.className = 'constructor-3d__canvas';

    wrap.appendChild(renderer.domElement);



    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;

    controls.dampingFactor = 0.08;

    controls.minDistance = 3;

    controls.maxDistance = 120;

    controls.maxPolarAngle = Math.PI / 2.02;



    scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    const sun = new THREE.DirectionalLight(0xfff0cc, 1.1);

    sun.position.set(-8, 16, 10);

    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x88aaff, 0.35);

    fill.position.set(8, 5, -6);

    scene.add(fill);



    const grid = new THREE.GridHelper(50, 50, 0x334155, 0x243044);

    grid.position.y = -0.03;

    scene.add(grid);



    const content = new THREE.Group();

    scene.add(content);



    const resize = () => {

      const w = Math.max(wrap.clientWidth, 280);

      const h = Math.max(wrap.clientHeight, 280);

      camera.aspect = w / h;

      camera.updateProjectionMatrix();

      renderer.setSize(w, h, false);

    };



    const ro = new ResizeObserver(resize);

    ro.observe(wrap);

    resize();



    let frameId = 0;

    const animate = () => {

      frameId = requestAnimationFrame(animate);

      controls.update();

      renderer.render(scene, camera);

    };

    animate();



    engineRef.current = { scene, camera, renderer, controls, content, resize };

    setReady(true);



    return () => {

      setReady(false);

      cancelAnimationFrame(frameId);

      ro.disconnect();

      controls.dispose();

      disposeObject(content);

      renderer.dispose();

      if (wrap.contains(renderer.domElement)) wrap.removeChild(renderer.domElement);

      engineRef.current = null;

    };

  }, []);



  useEffect(() => {

    if (!ready) return;

    const engine = engineRef.current;

    if (!engine) return;



    const { content, camera, controls } = engine;

    while (content.children.length) {

      const child = content.children[0];

      content.remove(child);

      disposeObject(child);

    }



    const facetList = facets?.length

      ? facets

      : hasRoof && roofPolygon?.length >= 3

        ? [{

          id: 'whole',

          polygon: toLocalPolygon(roofPolygon, ...Object.values(getPolygonRef(roofPolygon))),

          pitchDeg,

          azimuthDeg,

        }]

        : [];



    if (!facetList.length) {

      const demo = createTiltGroup(0, 0, pitchDeg, azimuthDeg);

      const geo = new THREE.PlaneGeometry(9, 6);

      geo.rotateX(-Math.PI / 2);

      const mesh = new THREE.Mesh(

        geo,

        new THREE.MeshStandardMaterial({ color: 0x475569, side: THREE.DoubleSide, roughness: 0.85 }),

      );

      demo.add(mesh);

      content.add(demo);

      controls.target.set(0, 0, 0);

      camera.position.set(10, 7, 12);

      engine.resize();

      return;

    }



    const panelW = moduleWidthM || 2.08;

    const panelH = moduleHeightM || 1.02;

    const panelList = (activePanels || []).filter((p) => p.active !== false);

    const bounds = new THREE.Box3();



    facetList.forEach((facet, facetIdx) => {

      const { polygon } = facet;

      if (!polygon?.length || polygon.length < 3) return;



      const { x: cx, y: cy } = polygonCentroid(polygon);

      const fPitch = facet.pitchDeg ?? pitchDeg;

      const fAz = facet.azimuthDeg ?? azimuthDeg;

      const tiltGroup = createTiltGroup(cx, cy, fPitch, fAz);



      const roofGeo = buildShapeGeometry(polygon, cx, cy);

      const roofColor = facetIdx % 2 === 0 ? 0x475569 : 0x52667a;

      const roofMesh = new THREE.Mesh(

        roofGeo,

        new THREE.MeshStandardMaterial({ color: roofColor, side: THREE.DoubleSide, roughness: 0.88 }),

      );

      roofMesh.position.y = 0.01;

      tiltGroup.add(roofMesh);



      const facetPanels = panelList.filter((p) => {
        if (facet.id === 'whole') return true;
        return p.facetId === facet.id;
      });



      facetPanels.forEach((panel) => {

        const lx = panel.localX ?? 0;

        const ly = panel.localY ?? 0;

        const isSelected = panel.id === selectedPanelId;

        const color = isSelected ? 0xe3a50b : 0x1b8a45;

        const pMesh = new THREE.Mesh(

          new THREE.BoxGeometry(panelW * 0.96, 0.06, panelH * 0.96),

          new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.45 }),

        );

        pMesh.position.set(lx - cx, 0.05, ly - cy);

        tiltGroup.add(pMesh);

      });



      content.add(tiltGroup);

      bounds.expandByObject(tiltGroup);

    });



    if (roofEdges?.length && roofPolygon?.length >= 3) {

      const { refLat, refLng } = getPolygonRef(roofPolygon);

      roofEdges.forEach((edge) => {

        const el = edgeToLocal(edge, refLat, refLng);

        const len = Math.hypot(el.to.x - el.from.x, el.to.y - el.from.y);

        if (len < 0.1) return;

        const midX = (el.from.x + el.to.x) / 2;

        const midZ = (el.from.y + el.to.y) / 2;

        const angle = Math.atan2(el.to.y - el.from.y, el.to.x - el.from.x);

        const rib = new THREE.Mesh(

          new THREE.BoxGeometry(len, 0.12, 0.18),

          new THREE.MeshStandardMaterial({ color: 0x103b5e, roughness: 0.5 }),

        );

        rib.position.set(midX, 0.08, midZ);

        rib.rotation.y = -angle;

        content.add(rib);

      });

    }



    const north = new THREE.ArrowHelper(

      new THREE.Vector3(0, 0, -1),

      new THREE.Vector3(0, 0.5, 0),

      2,

      0xe3a50b,

      0.5,

      0.35,

    );

    content.add(north);



    if (!bounds.isEmpty()) {

      const center = bounds.getCenter(new THREE.Vector3());

      const size = bounds.getSize(new THREE.Vector3());

      const radius = Math.max(size.x, size.y, size.z, 4) * 0.85;

      controls.target.copy(center);

      camera.position.set(center.x + radius, center.y + radius * 0.7, center.z + radius);

      camera.lookAt(center);

    } else {

      controls.target.set(0, 0, 0);

    }



    engine.resize();

  }, [

    ready,

    roofPolygon,

    roofEdges,

    facets,

    pitchDeg,

    azimuthDeg,

    moduleWidthM,

    moduleHeightM,

    activePanels,

    selectedPanelId,

    hasRoof,

  ]);



  const facetCount = facets?.length || 0;

  const edgeCount = roofEdges?.length || 0;



  return (

    <div className="constructor-3d-wrap">

      <div ref={wrapRef} className="constructor-3d" />

      <p className="constructor-map-hint">

        <strong>Управление:</strong> ЛКМ — вращение · колёсико — масштаб · ПКМ — сдвиг

        {' · '}

        уклон {pitchDeg}°, азимут {azimuthDeg}° (180° = юг)

        {edgeCount > 0 ? ` · рёбер: ${edgeCount}, скатов: ${facetCount}` : ''}

        {!hasRoof ? ' · обведите крышу на карте' : ''}

      </p>

    </div>

  );

}


