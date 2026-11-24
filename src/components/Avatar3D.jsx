import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { Move3d, RotateCcw } from "lucide-react";
import { useApp } from "../lib/store";
import { api as api2, avatarApi } from "../lib/bridge";
import { Img, Skeleton } from "./ui";

function studTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#6b6f78"; g.fillRect(0, 0, 64, 64);
  const grad = g.createRadialGradient(28, 28, 4, 32, 32, 20);
  grad.addColorStop(0, "#80848d"); grad.addColorStop(1, "#5d616a");
  g.fillStyle = grad; g.beginPath(); g.arc(32, 32, 17, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 2; g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 60);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function Avatar3D({ userId, fallback, version = 0, height = 420 }) {
  const { launchAs } = useApp();
  const mount = useRef(null);
  const api = useRef({});
  const [st, setSt] = useState("loading");
  const [err, setErr] = useState("");
  const [retry, setRetry] = useState(0);
  const [picture, setPicture] = useState(null);
  useEffect(() => {
    if (fallback || !userId) return;
    let live = true;
    api2("avatarImage", userId).then((u) => live && setPicture(u)).catch(() => {});
    return () => { live = false; };
  }, [userId, fallback]);

  useEffect(() => {
    if (!launchAs || !avatarApi) { setSt("2d"); return; }
    let disposed = false;
    setSt("loading");
    const el = mount.current;
    const w = el.clientWidth, h = el.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x14151a, 30, 90);
    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 500);
    camera.position.set(6, 4.5, 9);

    scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x3a3d44, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.4);
    sun.position.set(8, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 8, bottom: -2 });
    scene.add(sun);

    const plate = new THREE.Mesh(new THREE.BoxGeometry(120, 0.6, 120), new THREE.MeshStandardMaterial({ map: studTexture(), roughness: 0.85 }));
    plate.position.y = -0.3;
    plate.receiveShadow = true;
    scene.add(plate);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3;
    controls.maxDistance = 22;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.2;
    controls.addEventListener("start", () => { controls.autoRotate = false; });

    let raf;
    const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); };
    loop();
    const ro = new ResizeObserver(() => {
      const W = el.clientWidth, H = el.clientHeight;
      renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix();
    });
    ro.observe(el);

    const home = { pos: camera.position.clone(), target: new THREE.Vector3(0, 2.6, 0) };
    controls.target.copy(home.target);
    api.current.reset = () => { camera.position.copy(home.pos); controls.target.copy(home.target); controls.autoRotate = true; };

    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("3D took too long to load")), 30000));
    Promise.race([avatarApi.model3d(launchAs.id, userId), timeout]).then((m) => {
      if (disposed) return;
      const manager = new THREE.LoadingManager();
      manager.setURLModifier((url) => { const key = url.split("/").pop(); return m.textures[key] || url; });
      const materials = new MTLLoader(manager).parse(m.mtl, "");
      materials.preload();
      const bake = (mat) => {
        const img = mat.map?.image;
        if (!img || !img.width) return;
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d");
        g.fillStyle = `#${mat.color.getHexString(THREE.SRGBColorSpace)}`;
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = mat.map.flipY;
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
      };
      for (const mat of Object.values(materials.materials)) {
        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
        mat.side = THREE.DoubleSide;
        mat.transparent = false;
        mat.opacity = 1;
        mat.depthWrite = true;
        mat.shininess = 12;
        const isBody = /^Player/i.test(mat.name);
        mat.alphaTest = isBody ? 0 : 0.02;
        if (isBody && mat.map) {
          if (mat.map.image?.complete !== false && mat.map.image?.width) bake(mat);
          else mat.map.onUpdate = () => {};
          manager.onLoad = () => { for (const m2 of Object.values(materials.materials)) if (/^Player/i.test(m2.name) && m2.map && !(m2.map instanceof THREE.CanvasTexture)) bake(m2); };
        }
      }
      const obj = new OBJLoader(manager).setMaterials(materials).parse(m.obj);
      obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const cx = (m.aabb.min.x + m.aabb.max.x) / 2, cz = (m.aabb.min.z + m.aabb.max.z) / 2;
      obj.position.set(-cx, -m.aabb.min.y, -cz);
      const hgt = m.aabb.max.y - m.aabb.min.y;
      scene.add(obj);
      home.target.set(0, hgt * 0.5, 0);
      home.pos.set(hgt * 1.25, hgt * 0.95, hgt * 2.1);
      api.current.reset();
      setSt("ready");
    }).catch((e) => { if (!disposed) { setErr(e.message.replace(/^.*Error: /, "")); setSt("2d"); } });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach((mm) => { mm.map?.dispose(); mm.dispose(); }); });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [launchAs?.id, userId, version, retry]);

  const flat = fallback || picture;
  return (
    <div className="avatar3d" style={{ height }}>
      <div className="avatar3d-canvas" ref={mount} />
      {st === "loading" && (
        <div className="avatar3d-overlay">
          {flat ? <Img src={flat} className="avatar3d-flat loading" /> : <Skeleton w={120} h={220} r={16} />}
          <small className="avatar3d-pill"><span className="spin-dot" /> Loading 3D…</small>
        </div>
      )}
      {st === "2d" && (
        <div className="avatar3d-overlay flat">
          {flat ? <Img src={flat} className="avatar3d-flat" /> : <Skeleton w={140} h={220} r={16} />}
          {launchAs ? (
            <div className="avatar3d-retry">
              {err && <small>{err}</small>}
              <button className="btn glass sm" style={{ pointerEvents: "auto" }} onClick={() => { setErr(""); setRetry((r) => r + 1); }}><RotateCcw size={12} /> Try 3D again</button>
            </div>
          ) : <small>Sign in to see avatars in 3D</small>}
        </div>
      )}
      {st === "ready" && (
        <div className="avatar3d-hud">
          <span><Move3d size={12} /> Drag to rotate · scroll to zoom · right-drag to pan</span>
          <button className="btn glass sm icon-only" title="Reset view" onClick={() => api.current.reset?.()}><RotateCcw size={13} /></button>
        </div>
      )}
    </div>
  );
}
