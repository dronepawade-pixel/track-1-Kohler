"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Html,
  Lightformer,
  OrbitControls,
  RoundedBox,
  useGLTF,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MetreFixture, MetreOpening, RoomDims } from "./scene";

// Glossy monochrome dollhouse — three.js PBR. Same data as the SVG viewer:
// void-black canvas, satin walls, clearcoat ceramic fixtures, chrome + glass
// accents. Front-facing walls section at CUT_H via clipping planes so the
// interior stays visible while orbiting (matches the SVG cutaway behavior).

const WALL_T = 0.12;
const CUT_H = 1.1;
const CREAM = "#f5f5f0";
const CERAMIC = "#e9e7e1";

type ClipEntry = { mats: THREE.Material[]; normal: THREE.Vector3 };
type Registry = Map<string, ClipEntry>;

function useTileTexture(w: number, h: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#151515";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#242424";
    g.lineWidth = 3;
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 256); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(256, i); g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(Math.max(1, w / 2), Math.max(1, h / 2));
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [w, h]);
}

function std(color: string, roughness: number) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 });
}

function ceramic(color = CERAMIC) {
  return new THREE.MeshPhysicalMaterial({
    color, roughness: 0.12, metalness: 0.0,
    clearcoat: 1, clearcoatRoughness: 0.08,
  });
}

function chrome() {
  return new THREE.MeshStandardMaterial({ color: "#d9d9d9", roughness: 0.15, metalness: 1 });
}

function glassMat() {
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.05, metalness: 0,
    transmission: 0.92, thickness: 0.02, ior: 1.5,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
}

function Walls({ room, cutaway, registry }: { room: RoomDims; cutaway: boolean; registry: Registry }) {
  const H = room.height;
  const hx = room.w / 2;
  const hz = room.h / 2;
  const defs = useMemo(
    () => [
      { box: [-hx - WALL_T, hx + WALL_T, 0, H, -hz - WALL_T, -hz] as const, n: new THREE.Vector3(0, 0, -1) },
      { box: [-hx - WALL_T, hx + WALL_T, 0, H, hz, hz + WALL_T] as const, n: new THREE.Vector3(0, 0, 1) },
      { box: [-hx - WALL_T, -hx, 0, H, -hz, hz] as const, n: new THREE.Vector3(-1, 0, 0) },
      { box: [hx, hx + WALL_T, 0, H, -hz, hz] as const, n: new THREE.Vector3(1, 0, 0) },
    ],
    [hx, hz, H]
  );
  const mats = useMemo(() => defs.map(() => std("#1e1e1e", 0.9)), [defs]);
  const capMats = useMemo(() => defs.map(() => std("#2b2b2b", 0.8)), [defs]);
  useEffect(() => {
    defs.forEach((d, i) => registry.set(`wall-${i}`, { mats: [mats[i]], normal: d.n }));
  }, [defs, mats, registry]);
  // Caps ride the cut edge: full height normally, CUT_H when sectioned.
  const { camera, controls } = useThree();
  const caps = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    const ctl = controls as OrbitControlsImpl | null;
    const tgt = ctl?.target ?? new THREE.Vector3();
    const dir = new THREE.Vector3().subVectors(camera.position, tgt);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    caps.current.forEach((m, i) => {
      if (!m) return;
      const cut = cutaway && dir.dot(defs[i].n) > 0.15;
      m.position.y = (cut ? CUT_H : H) + 0.015;
    });
  });
  return (
    <group>
      {defs.map((d, i) => {
        const [x0, x1, y0, y1, z0, z1] = d.box;
        return (
          <mesh key={i} position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]} material={mats[i]} castShadow receiveShadow>
            <boxGeometry args={[x1 - x0, y1 - y0, z1 - z0]} />
          </mesh>
        );
      })}
      {defs.map((d, i) => {
        const [x0, x1, , , z0, z1] = d.box;
        return (
          <mesh
            key={`cap${i}`}
            ref={(m) => { caps.current[i] = m; }}
            position={[(x0 + x1) / 2, H + 0.015, (z0 + z1) / 2]}
            material={capMats[i]}
            castShadow
          >
            <boxGeometry args={[x1 - x0 + 0.05, 0.03, z1 - z0 + 0.05]} />
          </mesh>
        );
      })}
      {/* skirting on the four interior faces */}
      {[
        { p: [0, 0.045, -hz + 0.009], a: [room.w, 0.09, 0.018] },
        { p: [0, 0.045, hz - 0.009], a: [room.w, 0.09, 0.018] },
        { p: [-hx + 0.009, 0.045, 0], a: [0.018, 0.09, room.h] },
        { p: [hx - 0.009, 0.045, 0], a: [0.018, 0.09, room.h] },
      ].map((s, i) => (
        <mesh key={`sk${i}`} position={s.p as [number, number, number]} receiveShadow>
          <boxGeometry args={s.a as [number, number, number]} />
          <meshStandardMaterial color="#1f1f1f" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function OpeningModel({
  id, o, room, registry,
}: {
  id: string;
  o: MetreOpening;
  room: RoomDims;
  registry: Registry;
}) {
  const wallH = room.height; // walls are full height; sectioning is done by clipping
  const len = o.wall === "top" || o.wall === "bottom" ? room.w : room.h;
  const centre = -len / 2 + o.offsetM + o.widthM / 2;
  const wd = o.widthM;
  const alongX = o.wall === "top" || o.wall === "bottom";
  const at = o.wall === "top" ? -room.h / 2 : o.wall === "bottom" ? room.h / 2 : o.wall === "left" ? -room.w / 2 : room.w / 2;
  const nW = at + (at > 0 ? -WALL_T / 2 : WALL_T / 2);
  const normal = useMemo(
    () => new THREE.Vector3(o.wall === "left" ? -1 : o.wall === "right" ? 1 : 0, 0, o.wall === "top" ? -1 : o.wall === "bottom" ? 1 : 0),
    [o.wall]
  );
  const rotY = alongX ? 0 : Math.PI / 2;
  const px = alongX ? centre : nW;
  const pz = alongX ? nW : centre;

  const mats = useMemo(() => {
    if (o.kind === "door") return [std("#232323", 0.5)];
    return [std("#2b2b2b", 0.55)];
  }, [o.kind]);
  useEffect(() => {
    registry.set(id, { mats, normal });
    return () => { registry.delete(id); };
  }, [id, mats, normal, registry]);

  const door = useGLTF("/models/door-plain.glb");
  const win = useGLTF("/models/window-plain.glb");
  const model = useMemo(() => {
    const src = (o.kind === "door" ? door.scene : win.scene).clone(true);
    src.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mats[0];
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.kind, mats]);

  const sillMat = useMemo(() => std(CREAM, 0.4), []);
  const knobMat = useMemo(() => std(CREAM, 0.35), []);
  const glass = useMemo(() => glassMat(), []);
  const threshMat = useMemo(() => std("#1f1f1f", 0.85), []);

  if (o.kind === "door") {
    const dh = Math.min(2.1, wallH);
    if (dh < 0.6) return null;
    return (
      <group position={[px, 0, pz]} rotation={[0, rotY, 0]}>
        <primitive object={model} scale={wd / 0.91} />
        {/* lever knob accent on the leaf */}
        <mesh position={[(wd - 0.1) / 2 - 0.11, 1.02, 0.05]} material={knobMat} castShadow>
          <sphereGeometry args={[0.032, 20, 16]} />
        </mesh>
        <mesh position={[0, 0.014, 0]} material={threshMat} receiveShadow>
          <boxGeometry args={[wd + 0.04, 0.028, 0.17]} />
        </mesh>
      </group>
    );
  }
  if (wallH < 1.7) return null;
  const oh = Math.min(2.1, wallH) - 1.1;
  return (
    <group position={[px, 1.1, pz]} rotation={[0, rotY, 0]}>
      <primitive object={model} scale={[wd / 1.2, oh / 1.21, 1]} />
      {/* glass lite + cream sill ledge */}
      <mesh position={[0, oh / 2, 0]} material={glass}>
        <boxGeometry args={[wd - 0.12, oh - 0.12, 0.02]} />
      </mesh>
      <mesh position={[0, -0.03, 0.02]} material={sillMat} castShadow receiveShadow>
        <boxGeometry args={[wd + 0.16, 0.05, WALL_T + 0.12]} />
      </mesh>
    </group>
  );
}

function FixtureMesh({ f, labels }: { f: MetreFixture; labels: boolean }) {
  const body = useMemo(() => ceramic(), []);
  const dark = useMemo(() => ceramic("#3a3a38"), []);
  const charcoal = useMemo(() => std("#232323", 0.7), []);
  const glass = useMemo(() => glassMat(), []);
  const metal = useMemo(() => chrome(), []);
  const labelY = f.h + (f.glass ? 0.35 : 0.25);
  return (
    <group position={[f.cx, 0, f.cz]}>
      {f.kind === "Shower" ? (
        (() => {
          const gh = f.h - 0.1;
          return (
            <>
              <mesh position={[0, 0.05, 0]} material={body} castShadow receiveShadow>
                <boxGeometry args={[f.w, 0.1, f.d]} />
              </mesh>
              <mesh position={[0, 0.1 + gh / 2, -f.d / 2 + 0.02]} material={glass}>
                <boxGeometry args={[f.w, gh, 0.02]} />
              </mesh>
              <mesh position={[f.w / 2 - 0.02, 0.1 + gh / 2, 0]} material={glass}>
                <boxGeometry args={[0.02, gh, f.d]} />
              </mesh>
              <mesh position={[0, f.h + 0.02, 0]} material={metal} castShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.025, 28]} />
              </mesh>
              <mesh position={[0, (f.h + 0.1) / 2 + 0.05, -f.d / 2 + 0.02]} material={metal}>
                <cylinderGeometry args={[0.015, 0.015, f.h, 10]} />
              </mesh>
            </>
          );
        })()
      ) : f.kind === "Bathtub" ? (
        <>
          <RoundedBox args={[f.w, 0.58, f.d]} radius={0.09} smoothness={4} position={[0, 0.3, 0]} material={body} castShadow receiveShadow />
          <mesh position={[0, 0.47, 0]} material={dark} receiveShadow>
            <boxGeometry args={[f.w - 0.24, 0.1, f.d - 0.24]} />
          </mesh>
        </>
      ) : f.kind === "Toilet" ? (
        <>
          <RoundedBox args={[f.w, 0.42, f.d]} radius={0.1} smoothness={4} position={[0, 0.28, 0.04]} material={body} castShadow receiveShadow />
          <mesh position={[0, 0.62, -f.d / 2 + 0.12]} material={body} castShadow>
            <boxGeometry args={[f.w * 0.9, 0.5, 0.18]} />
          </mesh>
        </>
      ) : f.kind === "Vanity" ? (
        <>
          <mesh position={[0, 0.42, 0]} material={charcoal} castShadow receiveShadow>
            <boxGeometry args={[f.w, 0.8, f.d]} />
          </mesh>
          <mesh position={[0, 0.85, 0]} material={body} castShadow receiveShadow>
            <boxGeometry args={[f.w + 0.04, 0.05, f.d + 0.04]} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.4, 0]} material={body} castShadow receiveShadow>
            <boxGeometry args={[f.w * 0.5, 0.8, f.d * 0.6]} />
          </mesh>
          <RoundedBox args={[f.w, 0.16, f.d]} radius={0.06} smoothness={4} position={[0, 0.86, 0]} material={body} castShadow receiveShadow />
        </>
      )}
      {labels && (
        <Html center position={[0, labelY, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ fontSize: 11, color: "#fff", background: "rgba(0,0,0,0.55)", border: "1px solid #333", borderRadius: 9999, padding: "2px 10px", whiteSpace: "nowrap" }}>
            {f.kind}
          </div>
        </Html>
      )}
    </group>
  );
}

function SectionUpdater({ cutaway, registry }: { cutaway: boolean; registry: Registry }) {
  const { camera, controls } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), CUT_H), []);
  useFrame(() => {
    const ctl = controls as OrbitControlsImpl | null;
    const tgt = ctl?.target ?? new THREE.Vector3();
    const dir = new THREE.Vector3().subVectors(camera.position, tgt);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) return;
    dir.normalize();
    for (const e of registry.values())
      for (const m of e.mats) {
        const cut = cutaway && dir.dot(e.normal) > 0.15;
        const want = cut ? [plane] : null;
        if ((m.clippingPlanes?.length ?? 0) !== (want?.length ?? 0)) {
          m.clippingPlanes = want;
          m.needsUpdate = true;
        }
      }
  });
  return null;
}

function Scene({
  room, fixtures, openings, cutaway, labels, spin, controlsRef, registry,
}: {
  room: RoomDims;
  fixtures: MetreFixture[];
  openings: MetreOpening[];
  cutaway: boolean;
  labels: boolean;
  spin: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  registry: Registry;
}) {
  const tile = useTileTexture(room.w, room.h);
  const maxR = Math.max(room.w, room.h);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight
        position={[5, 7, 4]}
        intensity={3.2}
        color="#fff2e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-maxR}
        shadow-camera-right={maxR}
        shadow-camera-top={maxR}
        shadow-camera-bottom={-maxR}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[-4, 3, -5]} intensity={0.8} color="#cfd8ff" />
      <Environment resolution={256}>
        <Lightformer intensity={3.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color={CREAM} />
        <Lightformer intensity={0.8} position={[5, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} color="#dfe4ee" />
      </Environment>

      {/* floor slab + tile inlay border */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[room.w + 0.5, 0.1, room.h + 0.5]} />
        <meshStandardMaterial map={tile} roughness={0.85} />
      </mesh>
      {[
        { p: [0, 0.004, -room.h / 2 + 0.15], a: [room.w - 0.3, 0.004, 0.02] },
        { p: [0, 0.004, room.h / 2 - 0.15], a: [room.w - 0.3, 0.004, 0.02] },
        { p: [-room.w / 2 + 0.15, 0.004, 0], a: [0.02, 0.004, room.h - 0.3] },
        { p: [room.w / 2 + 0.15, 0.004, 0], a: [0.02, 0.004, room.h - 0.3] },
      ].map((s, i) => (
        <mesh key={i} position={s.p as [number, number, number]}>
          <boxGeometry args={s.a as [number, number, number]} />
          <meshStandardMaterial color="#333333" roughness={0.8} />
        </mesh>
      ))}

      <SectionUpdater cutaway={cutaway} registry={registry} />
      <Walls room={room} cutaway={cutaway} registry={registry} />
      {openings.map((o, i) => (
        <OpeningModel key={i} id={`opening-${i}`} o={o} room={room} registry={registry} />
      ))}
      {fixtures.map((f) => (
        <FixtureMesh key={f.id} f={f} labels={labels} />
      ))}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0.7, 0]}
        enableDamping
        dampingFactor={0.08}
        minDistance={2.2}
        maxDistance={16}
        maxPolarAngle={1.45}
        autoRotate={spin}
        autoRotateSpeed={0.9}
      />
    </>
  );
}

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

export default function RoomCanvas({
  room, fixtures, openings,
}: {
  room: RoomDims;
  fixtures: MetreFixture[];
  openings: MetreOpening[];
}) {
  const [cutaway, setCutaway] = useState(true);
  const [labels, setLabels] = useState(true);
  const [spin, setSpin] = useState(false);
  const [az, setAz] = useState(Math.PI / 4);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const registry = useMemo<Registry>(() => new Map(), []);

  const nudge = (d: number) => {
    const c = controlsRef.current;
    if (!c) return;
    const next = az + d;
    setAz(next);
    c.setAzimuthalAngle(next);
  };

  return (
    <div>
      <div style={{ height: 560, borderRadius: 10, overflow: "hidden", background: "#000" }}>
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [4.6, 3.8, 6.2], fov: 42 }}
          gl={{ antialias: true, localClippingEnabled: true }}
        >
          <color attach="background" args={["#000000"]} />
          <Suspense fallback={null}>
            <Scene
              room={room}
              fixtures={fixtures}
              openings={openings}
              cutaway={cutaway}
              labels={labels}
              spin={spin}
              controlsRef={controlsRef}
              registry={registry}
            />
          </Suspense>
        </Canvas>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => nudge(-Math.PI / 4)} className="btn-ghost !px-3 !py-2 !text-[13px]">⟲ 45°</button>
        <button onClick={() => nudge(Math.PI / 4)} className="btn-ghost !px-3 !py-2 !text-[13px]">45° ⟳</button>
        <button onClick={() => { controlsRef.current?.reset(); setAz(Math.PI / 4); }} className="btn-ghost !px-3 !py-2 !text-[13px]">Reset view</button>
        <button onClick={() => setCutaway((c) => !c)} className={cutaway ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}>
          Cutaway {cutaway ? "on" : "off"}
        </button>
        <button onClick={() => setLabels((l) => !l)} className={labels ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}>
          Labels {labels ? "on" : "off"}
        </button>
        <button onClick={() => setSpin((s) => !s)} className={spin ? "btn-cream !px-3 !py-2 !text-[13px]" : "btn-ghost !px-3 !py-2 !text-[13px]"}>
          Turntable {spin ? "on" : "off"}
        </button>
      </div>
      <p className="mt-3 text-[13px] text-[#999]">Drag to orbit · scroll to zoom · front walls section at {CUT_H} m so you can see inside.</p>
    </div>
  );
}

useGLTF.preload("/models/door-plain.glb");
useGLTF.preload("/models/window-plain.glb");
