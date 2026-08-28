"use client";

import { useEffect, useRef, useState } from "react";
import { Rotate3D, RotateCcw } from "lucide-react";
import type { BufferGeometry, MeshStandardMaterial } from "three";

type View = "front" | "side" | "back";
const angles: Record<View, number> = { front: 0, side: -Math.PI / 2, back: Math.PI };

export default function Avatar3DViewer({ assetUrl = "/assets/avatar/pilot-demo-avatar.gltf" }: { assetUrl?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetAngle = useRef(0);
  const [view, setView] = useState<View>("front");
  const [status, setStatus] = useState("Loading 3D viewer…");
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let frame = 0;
    let cleanup = () => {};
    void (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf1f3ed);
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 1.4, 6.4);
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      const pivot = new THREE.Group();
      scene.add(pivot);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x667366, 2.1));
      const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(4, 6, 5); scene.add(key);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), new THREE.MeshStandardMaterial({ color: 0xdfe4da, roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.position.y = -2.15; scene.add(floor);
      const fallback = () => {
        const skin = new THREE.MeshStandardMaterial({ color: 0xa87e68, roughness: .88 });
        const fabric = new THREE.MeshStandardMaterial({ color: 0x526f59, roughness: .78 });
        const dark = new THREE.MeshStandardMaterial({ color: 0x26342b, roughness: .8 });
        const add = (geometry: BufferGeometry, material: MeshStandardMaterial, position: [number,number,number], scale: [number,number,number] = [1,1,1]) => {
          const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.scale.set(...scale); mesh.castShadow = true; pivot.add(mesh);
        };
        add(new THREE.SphereGeometry(.42, 32, 24), skin, [0,1.53,0]);
        add(new THREE.CapsuleGeometry(.67,1.05,12,24), fabric, [0,.42,0], [1,.95,.55]);
        add(new THREE.CapsuleGeometry(.16,1.2,8,16), skin, [-.78,.35,0], [1,1,.85]);
        add(new THREE.CapsuleGeometry(.16,1.2,8,16), skin, [.78,.35,0], [1,1,.85]);
        add(new THREE.CapsuleGeometry(.22,1.45,8,16), dark, [-.34,-1.35,0]);
        add(new THREE.CapsuleGeometry(.22,1.45,8,16), dark, [.34,-1.35,0]);
        setStatus("Interactive generic mannequin loaded");
      };
      new GLTFLoader().load(assetUrl, (gltf) => {
        if (disposed) return;
        let hasMesh = false;
        gltf.scene.traverse((object) => { if (object instanceof THREE.Mesh) hasMesh = true; });
        if (hasMesh) {
          gltf.scene.scale.setScalar(1.4); gltf.scene.position.y = -2.1; pivot.add(gltf.scene); setStatus("3D asset loaded");
        } else fallback();
      }, undefined, fallback);
      const resize = () => {
        const width = container.clientWidth, height = Math.max(360, container.clientHeight);
        renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
      };
      resize(); const observer = new ResizeObserver(resize); observer.observe(container);
      let dragging = false, lastX = 0;
      const down = (event: PointerEvent) => { dragging = true; lastX = event.clientX; renderer.domElement.setPointerCapture(event.pointerId); };
      const move = (event: PointerEvent) => { if (dragging) { targetAngle.current += (event.clientX - lastX) * .012; lastX = event.clientX; } };
      const up = () => { dragging = false; };
      renderer.domElement.addEventListener("pointerdown", down); renderer.domElement.addEventListener("pointermove", move); renderer.domElement.addEventListener("pointerup", up);
      const animate = () => { pivot.rotation.y += (targetAngle.current - pivot.rotation.y) * .12; renderer.render(scene, camera); frame = requestAnimationFrame(animate); };
      animate();
      cleanup = () => { observer.disconnect(); cancelAnimationFrame(frame); renderer.domElement.removeEventListener("pointerdown", down); renderer.domElement.removeEventListener("pointermove", move); renderer.domElement.removeEventListener("pointerup", up); renderer.dispose(); renderer.domElement.remove(); };
    })();
    return () => { disposed = true; cleanup(); };
  }, [assetUrl]);
  const choose = (next: View) => { setView(next); targetAngle.current = angles[next]; };
  return <div className="avatar-viewer-wrap">
    <div ref={containerRef} className="avatar-canvas" role="img" aria-label="Interactive 3D avatar preview. Drag horizontally to rotate." />
    <div className="avatar-controls" aria-label="Avatar view controls">
      {(["front", "side", "back"] as View[]).map((item) => <button className={view === item ? "selected" : ""} key={item} onClick={() => choose(item)}>{item}</button>)}
      <button onClick={() => choose("front")}><RotateCcw /> Reset</button>
    </div>
    <p role="status"><Rotate3D /> {status}. Drag to rotate.</p>
  </div>;
}
