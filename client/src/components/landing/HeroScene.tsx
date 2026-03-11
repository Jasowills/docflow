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

    const ambient = new THREE.AmbientLight(0xd9ffe8, 0.85);
    const keyLight = new THREE.PointLight(0x2ce67d, 8, 22);
    keyLight.position.set(2.8, 2.1, 4.2);
    const fillLight = new THREE.PointLight(0x7cffc4, 2.6, 18);
    fillLight.position.set(-2.4, -1.6, 3.4);
    scene.add(ambient, keyLight, fillLight);

    const group = new THREE.Group();
    scene.add(group);

    const ringMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x14c76b,
      roughness: 0.14,
      metalness: 0.5,
      clearcoat: 1,
      transparent: true,
      opacity: 0.94,
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
        color: 0x9ef7c4,
        emissive: 0x0f8d4c,
        emissiveIntensity: 0.42,
        roughness: 0.24,
        metalness: 0.2,
      }),
    );
    ribbon.rotation.x = 0.8;
    ribbon.rotation.z = 0.25;
    group.add(ribbon);

    const particles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: 0xd8ffea,
        size: 0.03,
        transparent: true,
        opacity: 0.78,
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
      ring.rotation.z = elapsed * 0.22;
      ribbon.rotation.y = elapsed * 0.38;
      ribbon.rotation.x = 0.8 + Math.sin(elapsed * 0.72) * 0.12;
      group.rotation.y = Math.sin(elapsed * 0.33) * 0.2;
      group.position.y = Math.sin(elapsed * 0.72) * 0.1;
      particles.rotation.y = -elapsed * 0.05;
      particles.rotation.x = Math.sin(elapsed * 0.18) * 0.08;
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
