import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useTheme } from '../../context/ThemeContext';

interface Interactive3DSceneProps {
  className?: string;
  intensity?: number;
}

export const Interactive3DScene: React.FC<Interactive3DSceneProps> = ({
  className = '',
  intensity = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const isDark = theme === 'dark';

    // 1. Scene, Camera, Renderer Setup
    const scene = new THREE.Scene();
    const width = window.innerWidth;
    const height = window.innerHeight;

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 1000);
    camera.position.set(0, 0, 32);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Fog for smooth infinite depth fading
    const fogColor = isDark ? 0x09090b : 0xf8fafc;
    scene.fog = new THREE.FogExp2(fogColor, 0.016);

    // 2. Lighting Rig
    const ambientLight = new THREE.AmbientLight(
      isDark ? 0x1e293b : 0xffffff,
      isDark ? 1.4 : 1.6
    );
    scene.add(ambientLight);

    // Primary Interactive Mouse PointLight (Cyan/Sky Blue)
    const mouseLight = new THREE.PointLight(
      isDark ? 0x38bdf8 : 0x0284c7,
      (isDark ? 4.5 : 3.6) * intensity,
      48
    );
    mouseLight.position.set(0, 0, 10);
    scene.add(mouseLight);

    // Secondary Accent PointLight (FPT Warm Orange)
    const accentLight = new THREE.PointLight(
      0xf97316,
      (isDark ? 3.8 : 2.8) * intensity,
      42
    );
    accentLight.position.set(12, 4, 8);
    scene.add(accentLight);

    // Subtle Corner Fill Light
    const fillLight = new THREE.PointLight(
      isDark ? 0x6366f1 : 0x3b82f6,
      2.0 * intensity,
      40
    );
    fillLight.position.set(-16, -8, 6);
    scene.add(fillLight);

    // 3. Circular Glow Particle Texture Helper
    const createGlowTexture = () => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const ctx = c.getContext('2d')!;
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.25, isDark ? 'rgba(56, 189, 248, 0.9)' : 'rgba(2, 132, 199, 0.85)');
      grad.addColorStop(0.55, isDark ? 'rgba(249, 115, 22, 0.4)' : 'rgba(249, 115, 22, 0.35)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    };

    const particleTexture = createGlowTexture();

    // 4. Interactive IoT Mesh Nodes & Particle System
    const NODE_COUNT = 90;
    interface NodeData {
      pos: THREE.Vector3;
      basePos: THREE.Vector3;
      vel: THREE.Vector3;
      phase: number;
      speed: number;
      isOrange: boolean;
    }

    const nodes: NodeData[] = [];
    const nodePositions = new Float32Array(NODE_COUNT * 3);
    const nodeColors = new Float32Array(NODE_COUNT * 3);

    const colorCyan = new THREE.Color(isDark ? 0x38bdf8 : 0x0284c7);
    const colorOrange = new THREE.Color(0xf97316);
    const colorWhite = new THREE.Color(isDark ? 0xe2e8f0 : 0x64748b);

    for (let i = 0; i < NODE_COUNT; i++) {
      const x = (Math.random() - 0.5) * 75;
      const y = (Math.random() - 0.5) * 46;
      const z = (Math.random() - 0.5) * 28;

      const isOrange = Math.random() < 0.22;
      const col = isOrange ? colorOrange : (Math.random() < 0.6 ? colorCyan : colorWhite);

      nodes.push({
        pos: new THREE.Vector3(x, y, z),
        basePos: new THREE.Vector3(x, y, z),
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.008
        ),
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        isOrange,
      });

      nodePositions[i * 3] = x;
      nodePositions[i * 3 + 1] = y;
      nodePositions[i * 3 + 2] = z;

      nodeColors[i * 3] = col.r;
      nodeColors[i * 3 + 1] = col.g;
      nodeColors[i * 3 + 2] = col.b;
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeometry.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));

    const nodeMaterial = new THREE.PointsMaterial({
      size: isDark ? 1.6 : 1.35,
      map: particleTexture,
      transparent: true,
      opacity: isDark ? 0.9 : 0.8,
      vertexColors: true,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });

    const nodePoints = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(nodePoints);

    // 5. Dynamic Connecting Line Segments (IoT Constellation Lines)
    const MAX_LINES = 260;
    const linePositions = new Float32Array(MAX_LINES * 6);
    const lineColors = new Float32Array(MAX_LINES * 6);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: isDark ? 0.42 : 0.25,
      blending: isDark ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    });

    const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lineSegments);

    // 6. Ambient Star Field (Background Depth Dust)
    const DUST_COUNT = 240;
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 75;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 50;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 8;
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      size: 0.65,
      color: isDark ? 0x38bdf8 : 0x94a3b8,
      transparent: true,
      opacity: isDark ? 0.35 : 0.25,
      depthWrite: false,
    });
    const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustPoints);

    // 7. Floating 3D Geometric Objects (IoT Hardware & Signal Waves)
    const hardwareGroup = new THREE.Group();
    scene.add(hardwareGroup);

    // A. Main RF Signal Ring (Holographic Torus near right hero area)
    const torusGeo1 = new THREE.TorusGeometry(4.2, 0.05, 16, 80);
    const torusMat1 = new THREE.MeshStandardMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.45 : 0.3,
    });
    const torus1 = new THREE.Mesh(torusGeo1, torusMat1);
    torus1.position.set(13, 1.5, -4);
    torus1.rotation.set(Math.PI / 4, Math.PI / 6, 0);
    hardwareGroup.add(torus1);

    // B. Outer Orbit Ring
    const torusGeo2 = new THREE.TorusGeometry(6.0, 0.035, 16, 90);
    const torusMat2 = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.4 : 0.25,
    });
    const torus2 = new THREE.Mesh(torusGeo2, torusMat2);
    torus2.position.set(13, 1.5, -4);
    torus2.rotation.set(-Math.PI / 3, Math.PI / 5, 0);
    hardwareGroup.add(torus2);

    // C. Center Sensor Core (Faceted Icosahedron inside the rings)
    const coreGeo = new THREE.IcosahedronGeometry(1.5, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x0f172a : 0xffffff,
      roughness: 0.2,
      metalness: 0.8,
      transparent: true,
      opacity: isDark ? 0.75 : 0.65,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.set(13, 1.5, -4);

    // Core wireframe outline
    const coreWireMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.6 : 0.4,
    });
    const coreWire = new THREE.Mesh(coreGeo, coreWireMat);
    coreMesh.add(coreWire);
    hardwareGroup.add(coreMesh);

    // D. Left Secondary Signal Wave (Subtle Torus)
    const torusGeo3 = new THREE.TorusGeometry(3.0, 0.04, 16, 60);
    const torusMat3 = new THREE.MeshStandardMaterial({
      color: isDark ? 0x818cf8 : 0x3b82f6,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.35 : 0.2,
    });
    const torus3 = new THREE.Mesh(torusGeo3, torusMat3);
    torus3.position.set(-15, -4, -6);
    torus3.rotation.set(Math.PI / 5, -Math.PI / 4, 0);
    hardwareGroup.add(torus3);

    // E. Floating Smart Micro-Cubes (IoT Edge Data Nodes)
    const cubeCount = 6;
    const cubes: THREE.Mesh[] = [];
    const cubeCoords = [
      { x: -14, y: 7, z: -5 },
      { x: 18, y: 8, z: -8 },
      { x: -9, y: -9, z: -3 },
      { x: 9, y: -10, z: -6 },
      { x: 21, y: -6, z: -5 },
      { x: -21, y: 3, z: -8 },
    ];

    cubeCoords.forEach((coord, idx) => {
      const cGeo = new THREE.BoxGeometry(0.85, 0.85, 0.85);
      const isOrangeCube = idx % 2 === 1;
      const cMat = new THREE.MeshStandardMaterial({
        color: isOrangeCube ? 0xf97316 : (isDark ? 0x38bdf8 : 0x0284c7),
        wireframe: true,
        transparent: true,
        opacity: isDark ? 0.45 : 0.28,
      });
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.set(coord.x, coord.y, coord.z);
      hardwareGroup.add(cMesh);
      cubes.push(cMesh);
    });

    // 8. Interactive 3D Cyber Wave Grid Plane (Floor Ripple Mesh)
    const gridCols = 56;
    const gridRows = 32;
    const waveGeo = new THREE.PlaneGeometry(105, 52, gridCols, gridRows);
    const waveMat = new THREE.MeshBasicMaterial({
      color: isDark ? 0x0284c7 : 0x2563eb,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.14 : 0.08,
    });
    const wavePlane = new THREE.Mesh(waveGeo, waveMat);
    wavePlane.position.set(0, -14, -8);
    wavePlane.rotation.x = -Math.PI * 0.42;
    scene.add(wavePlane);

    // Cache original grid vertex positions for ripple math
    const wavePosAttr = waveGeo.attributes.position as THREE.BufferAttribute;
    const origWaveZ = new Float32Array(wavePosAttr.count);
    for (let i = 0; i < wavePosAttr.count; i++) {
      origWaveZ[i] = wavePosAttr.getZ(i);
    }

    // 9. Interactive Mouse State & Coordinates
    const mouse = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      worldX: 0,
      worldY: 0,
      targetWorldX: 0,
      targetWorldY: 0,
      lastMoveTime: performance.now(),
      isMoving: false,
    };

    // Click Shockwave Pulse State
    const clickPulse = {
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      strength: 0,
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Normalized Device Coordinates [-1, 1]
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;

      // Approximate 3D world plane at Z=0
      mouse.targetWorldX = mouse.targetX * 24;
      mouse.targetWorldY = mouse.targetY * 15;

      mouse.lastMoveTime = performance.now();
      mouse.isMoving = true;
    };

    const handlePointerDown = (e: MouseEvent) => {
      const clickX = ((e.clientX / window.innerWidth) * 2 - 1) * 24;
      const clickY = (-(e.clientY / window.innerHeight) * 2 + 1) * 15;
      clickPulse.active = true;
      clickPulse.x = clickX;
      clickPulse.y = clickY;
      clickPulse.radius = 0;
      clickPulse.strength = 1.0;
    };

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    window.addEventListener('resize', handleResize);

    // 10. Animation Render Loop with Silky Lerp & Interactive Physics
    let animationId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.055;
      mouse.y += (mouse.targetY - mouse.y) * 0.055;
      mouse.worldX += (mouse.targetWorldX - mouse.worldX) * 0.06;
      mouse.worldY += (mouse.targetWorldY - mouse.worldY) * 0.06;

      // Check if mouse stopped
      if (performance.now() - mouse.lastMoveTime > 150) {
        mouse.isMoving = false;
      }

      // Smooth Camera Parallax (3D Perspective Tilting)
      const targetCamX = mouse.x * 3.2;
      const targetCamY = mouse.y * 2.0;
      camera.position.x += (targetCamX - camera.position.x) * 0.045;
      camera.position.y += (targetCamY - camera.position.y) * 0.045;
      camera.lookAt(0, 0, 0);

      // Mouse 3D PointLight follows cursor
      mouseLight.position.x = mouse.worldX;
      mouseLight.position.y = mouse.worldY;
      mouseLight.position.z = 8 + Math.sin(elapsedTime * 2.5) * 1.5;

      // Accent light orbits opposite side gently
      accentLight.position.x = 12 + Math.sin(elapsedTime * 0.8) * 3 - mouse.x * 2;
      accentLight.position.y = 4 + Math.cos(elapsedTime * 0.8) * 2 - mouse.y * 2;

      // Handle Click Shockwave expansion
      if (clickPulse.active) {
        clickPulse.radius += 0.8;
        clickPulse.strength *= 0.94;
        if (clickPulse.strength < 0.05 || clickPulse.radius > 32) {
          clickPulse.active = false;
        }
      }

      // Update IoT Nodes & Interactive Physics
      const posAttr = nodeGeometry.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;

      const CONNECTION_DIST = 6.2;
      let lineVertexIdx = 0;
      const maxLineVertices = MAX_LINES * 2;

      for (let i = 0; i < NODE_COUNT; i++) {
        const node = nodes[i];
        node.phase += 0.018 * node.speed;

        // Base harmonic floating motion
        const floatX = Math.cos(node.phase) * 0.12;
        const floatY = Math.sin(node.phase * 1.3) * 0.15;
        const floatZ = Math.sin(node.phase * 0.8) * 0.1;

        node.basePos.add(node.vel);
        // Wrap boundary
        if (node.basePos.x < -38) node.basePos.x = 38;
        if (node.basePos.x > 38) node.basePos.x = -38;
        if (node.basePos.y < -24) node.basePos.y = 24;
        if (node.basePos.y > 24) node.basePos.y = -24;

        // Target position
        const targetPos = node.basePos.clone().add(new THREE.Vector3(floatX, floatY, floatZ));

        // MOUSE INTERACTION FORCE: Repel & Swirl around cursor
        const dx = node.pos.x - mouse.worldX;
        const dy = node.pos.y - mouse.worldY;
        const distToMouse = Math.hypot(dx, dy);

        if (distToMouse < 9.5) {
          const repelStrength = (1 - distToMouse / 9.5) * 2.8;
          const angle = Math.atan2(dy, dx);
          // Slight swirl + push
          targetPos.x += Math.cos(angle + 0.3) * repelStrength;
          targetPos.y += Math.sin(angle + 0.3) * repelStrength;
        }

        // CLICK SHOCKWAVE DISPLACEMENT
        if (clickPulse.active) {
          const distToClick = Math.hypot(node.pos.x - clickPulse.x, node.pos.y - clickPulse.y);
          const ringDist = Math.abs(distToClick - clickPulse.radius);
          if (ringDist < 3.0) {
            const pulseFactor = (1 - ringDist / 3.0) * clickPulse.strength * 4.0;
            const clickAngle = Math.atan2(node.pos.y - clickPulse.y, node.pos.x - clickPulse.x);
            targetPos.x += Math.cos(clickAngle) * pulseFactor;
            targetPos.y += Math.sin(clickAngle) * pulseFactor;
          }
        }

        // Smooth spring lerp to target
        node.pos.lerp(targetPos, 0.07);

        array[i * 3] = node.pos.x;
        array[i * 3 + 1] = node.pos.y;
        array[i * 3 + 2] = node.pos.z;

        // Dynamic Line Connections between nearby nodes
        for (let j = i + 1; j < NODE_COUNT; j++) {
          if (lineVertexIdx >= maxLineVertices) break;

          const otherNode = nodes[j];
          const dist = node.pos.distanceTo(otherNode.pos);

          if (dist < CONNECTION_DIST) {
            const lineAlpha = (1 - dist / CONNECTION_DIST);

            // Proximity to mouse boosts line visibility
            const midX = (node.pos.x + otherNode.pos.x) * 0.5;
            const midY = (node.pos.y + otherNode.pos.y) * 0.5;
            const mouseDistToLine = Math.hypot(midX - mouse.worldX, midY - mouse.worldY);
            const mouseBoost = mouseDistToLine < 8 ? (1 - mouseDistToLine / 8) * 1.5 : 0;

            const finalAlpha = Math.min(1.0, (lineAlpha + mouseBoost) * (isDark ? 0.7 : 0.45));

            // Line vertex 1
            linePositions[lineVertexIdx * 3] = node.pos.x;
            linePositions[lineVertexIdx * 3 + 1] = node.pos.y;
            linePositions[lineVertexIdx * 3 + 2] = node.pos.z;

            // Line vertex 2
            linePositions[(lineVertexIdx + 1) * 3] = otherNode.pos.x;
            linePositions[(lineVertexIdx + 1) * 3 + 1] = otherNode.pos.y;
            linePositions[(lineVertexIdx + 1) * 3 + 2] = otherNode.pos.z;

            // Color gradient for lines
            const isOrangeLine = node.isOrange || otherNode.isOrange;
            const r = isOrangeLine ? 0.97 : (isDark ? 0.22 : 0.01);
            const g = isOrangeLine ? 0.45 : (isDark ? 0.74 : 0.52);
            const b = isOrangeLine ? 0.09 : (isDark ? 0.97 : 0.78);

            lineColors[lineVertexIdx * 3] = r * finalAlpha;
            lineColors[lineVertexIdx * 3 + 1] = g * finalAlpha;
            lineColors[lineVertexIdx * 3 + 2] = b * finalAlpha;

            lineColors[(lineVertexIdx + 1) * 3] = r * finalAlpha;
            lineColors[(lineVertexIdx + 1) * 3 + 1] = g * finalAlpha;
            lineColors[(lineVertexIdx + 1) * 3 + 2] = b * finalAlpha;

            lineVertexIdx += 2;
          }
        }
      }

      posAttr.needsUpdate = true;

      // Clear remaining line vertices to avoid stale ghosts
      for (let k = lineVertexIdx; k < maxLineVertices; k++) {
        linePositions[k * 3] = 0;
        linePositions[k * 3 + 1] = 0;
        linePositions[k * 3 + 2] = 0;
        lineColors[k * 3] = 0;
        lineColors[k * 3 + 1] = 0;
        lineColors[k * 3 + 2] = 0;
      }

      lineGeometry.setDrawRange(0, lineVertexIdx);
      (lineGeometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (lineGeometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;

      // Animate 3D Floating Hardware Elements (RF Signal Rings & Cubes)
      torus1.rotation.z += 0.005;
      torus1.rotation.x = Math.PI / 4 + mouse.y * 0.25;
      torus1.rotation.y = Math.PI / 6 + mouse.x * 0.35;

      torus2.rotation.z -= 0.004;
      torus2.rotation.x = -Math.PI / 3 - mouse.y * 0.2;
      torus2.rotation.y = Math.PI / 5 - mouse.x * 0.25;

      coreMesh.rotation.x += 0.008;
      coreMesh.rotation.y += 0.012;

      torus3.rotation.z += 0.006;
      torus3.rotation.x = Math.PI / 5 + mouse.y * 0.2;

      // Animate Micro-Cubes with tumble & mouse tilt
      cubes.forEach((cube, idx) => {
        cube.rotation.x += 0.008 * (idx % 2 === 0 ? 1 : -1);
        cube.rotation.y += 0.01 * (idx % 3 === 0 ? 1 : -1);
        // Float oscillation
        cube.position.y += Math.sin(elapsedTime * 1.5 + idx) * 0.006;
      });

      // Animate 3D Cyber Wave Grid Plane Vertices with Mouse Ripple
      const wavePos = waveGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < wavePos.count; i++) {
        const u = wavePos.getX(i);
        const v = wavePos.getY(i);

        // Ambient sine undulation
        const baseWave =
          Math.sin(u * 0.18 + elapsedTime * 1.2) *
          Math.cos(v * 0.18 + elapsedTime * 0.8) *
          0.85;

        // Distance from mouse in grid space
        const distGrid = Math.hypot(u - mouse.worldX * 1.2, v - (mouse.worldY * 1.2 - 10));
        let mouseRipple = 0;
        if (distGrid < 14) {
          // Gaussian ripple dome trailing mouse
          const wavePulse = Math.sin(distGrid * 0.8 - elapsedTime * 3.5);
          mouseRipple = Math.exp(-(distGrid * distGrid) / 45) * 2.2 * wavePulse;
        }

        wavePos.setZ(i, origWaveZ[i] + baseWave + mouseRipple);
      }
      wavePos.needsUpdate = true;

      // Render Scene
      renderer.render(scene, camera);
    };

    animate();

    // 11. Cleanup
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', handleResize);

      // Dispose Three.js resources
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      torusGeo1.dispose();
      torusMat1.dispose();
      torusGeo2.dispose();
      torusMat2.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      coreWireMat.dispose();
      torusGeo3.dispose();
      torusMat3.dispose();
      waveGeo.dispose();
      waveMat.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, [theme, intensity]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block pointer-events-none"
      />
    </div>
  );
};
