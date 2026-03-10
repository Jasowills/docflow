import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export function HeroScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    const point = new THREE.PointLight(0x60a5fa, 8, 20);
    point.position.set(2.5, 2.5, 4);
    scene.add(ambient, point);

    const group = new THREE.Group();
    scene.add(group);

    const ringMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x2f6bff,
      roughness: 0.18,
      metalness: 0.4,
      clearcoat: 1,
      transparent: true,
      opacity: 0.92,
    });

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.45, 0.16, 24, 140),
      ringMaterial,
    );
    ring.rotation.x = 1.1;
    ring.rotation.y = 0.25;
    group.add(ring);

    const ribbon = new THREE.Mesh(
      new THREE.TorusKnotGeometry(0.88, 0.11, 220, 26, 2, 5),
      new THREE.MeshStandardMaterial({
        color: 0x8bc4ff,
        emissive: 0x0d3cff,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.15,
      }),
    );
    ribbon.rotation.x = 0.8;
    ribbon.rotation.z = 0.25;
    group.add(ribbon);

    const particles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xd8f1ff,
        size: 0.035,
        transparent: true,
        opacity: 0.85,
      }),
    );
    const count = 140;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 1.8 + Math.random() * 1.7;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 2.8;
      positions[index * 3] = Math.cos(angle) * radius;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = Math.sin(angle) * radius * 0.55;
    }
    particles.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(particles);

    const resize = () => {
      if (!mount) return;
      const { clientWidth, clientHeight } = mount;
      renderer.setSize(clientWidth, clientHeight);
      camera.aspect = clientWidth / clientHeight;
      camera.updateProjectionMatrix();
    };

    resize();
    window.addEventListener('resize', resize);

    let frameId = 0;
    const start = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      ring.rotation.z = elapsed * 0.25;
      ribbon.rotation.y = elapsed * 0.45;
      ribbon.rotation.x = 0.8 + Math.sin(elapsed * 0.8) * 0.14;
      group.rotation.y = Math.sin(elapsed * 0.4) * 0.28;
      group.position.y = Math.sin(elapsed * 0.9) * 0.12;
      particles.rotation.y = -elapsed * 0.07;
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
      ring.geometry.dispose();
      ringMaterial.dispose();
      ribbon.geometry.dispose();
      (ribbon.material as THREE.Material).dispose();
      particles.geometry.dispose();
      (particles.material as THREE.Material).dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className="landing-hero-scene" />;
}
