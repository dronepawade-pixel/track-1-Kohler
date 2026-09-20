"use client";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Html,
  Lightformer,
  MeshReflectorMaterial,
  OrbitControls,
  RoundedBox,
  useGLTF,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { MetreFixture, MetreOpening, RoomDims } from "./scene";
import { PROCEDURAL, modelOptions, optionById, optionsForKind, faucetForBasin, type ModelOption } from "@/lib/models";
import { decorById } from "@/lib/decor";

// Glossy monochrome dollhouse — three.js PBR. Same data as the SVG viewer:
// void-black canvas, satin walls, clearcoat ceramic fixtures, chrome + glass
// accents. Front-facing walls section at CUT_H via clipping planes so the
// interior stays visible while orbiting (matches the SVG cutaway behavior).

const WALL_T = 0.12;
const CUT_H = 1.1;
const CREAM = "#f5f5f0";
const CERAMIC = "#f0eee8";

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
    color, roughness: 0.07, metalness: 0.0,
    clearcoat: 1, clearcoatRoughness: 0.04,
    envMapIntensity: 1.7, specularIntensity: 1, sheen: 0.15, sheenColor: new THREE.Color("#ffffff"),
  });
}

function chrome() {
  // polished nickel tuned for a dark room: mostly dielectric so key/rim
  // lights model it directly, with enough metal for env streaks
  return new THREE.MeshStandardMaterial({ color: "#e8e8e8", roughness: 0.18, metalness: 0.85, envMapIntensity: 1.8 });
}

function glassMat() {
  return new THREE.MeshPhysicalMaterial({
    color: "#ffffff", roughness: 0.05, metalness: 0,
    transmission: 0.92, thickness: 0.02, ior: 1.5,
    transparent: true, opacity: 0.5, side: THREE.DoubleSide,
  });
}

// AI-matched variant tags → material. Colour/material tags from the
// taxonomy (black, marble, gold…) tint procedural bodies so a pick reads
// on screen even before a real GLB lands for that variant.
const FINISH_BY_TAG: [string, { color: string; metal: boolean }][] = [
  ["black", { color: "#2a2a2c", metal: false }],
  ["marble", { color: "#efece6", metal: false }],
  ["stone", { color: "#8f8d88", metal: false }],
  ["wood", { color: "#8a6a4f", metal: false }],
  ["gold", { color: "#d9a441", metal: true }],
  ["brass", { color: "#c8a24e", metal: true }],
  ["nickel", { color: "#cfcfcf", metal: true }],
  ["chrome", { color: "#e8e8e8", metal: true }],
  ["white", { color: CERAMIC, metal: false }],
];

function finishForTags(tags: string[] | undefined): { color: string; metal: boolean } | null {
  if (!tags) return null;
  for (const [tag, f] of FINISH_BY_TAG) if (tags.includes(tag)) return f;
  return null;
}

function finishMat(color: string, metal: boolean) {
  if (metal)
    return new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.85, envMapIntensity: 1.5 });
  return ceramic(color);
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

export type LampSpec = { id: string; label: string; color: string };
export const LAMPS: LampSpec[] = [
  { id: "warm", label: "Warm Lamp", color: "#ffd9a0" },
  { id: "cool", label: "Cool Daylight", color: "#dfe8ff" },
  { id: "teal", label: "Spa Teal", color: "#7de8e0" },
  { id: "amber", label: "Sunset Amber", color: "#ff9a5c" },
  { id: "rose", label: "Rose", color: "#ff7d9c" },
  { id: "violet", label: "Violet Night", color: "#b48cff" },
];
export const lampById = (id: string | null): LampSpec | null =>
  LAMPS.find((l) => l.id === id) ?? null;

// Pendant lamp: monochrome housing, the LIGHT carries the color.
// Hangs at room centre; bulb is unlit-tone-mapped so the color punches through.
function PendantLamp({ room, lamp }: { room: RoomDims; lamp: LampSpec }) {
  const shadeY = room.height - 0.66;
  const housing = useMemo(() => std("#1a1a1a", 0.6), []);
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, (room.height + shadeY + 0.11) / 2, 0]} material={housing}>
        <cylinderGeometry args={[0.008, 0.008, room.height - shadeY - 0.11, 8]} />
      </mesh>
      <mesh position={[0, shadeY, 0]} material={housing} castShadow>
        <cylinderGeometry args={[0.05, 0.22, 0.22, 28, 1, true]} />
      </mesh>
      <mesh position={[0, shadeY - 0.08, 0]}>
        <sphereGeometry args={[0.05, 20, 16]} />
        <meshBasicMaterial color={lamp.color} toneMapped={false} />
      </mesh>
      <pointLight position={[0, shadeY - 0.12, 0]} color={lamp.color} intensity={20} distance={10} decay={2} />
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

// Real Kohler scan fitted to a fixture footprint. Materials are overridden to
// the monochrome PBR set (ceramic / chrome / dark) to match the system.
function ModelPart({ opt, f }: { opt: ModelOption; f: MetreFixture }) {
  const { scene } = useGLTF(opt.glb);
  const mat = useMemo(() => {
    if (opt.fit === "head" || opt.fit === "faucet") return chrome();
    if (opt.fit === "screen") {
      const m = std("#2b2b2b", 0.32);
      m.envMapIntensity = 1.1;
      return m;
    }
    return ceramic();
  }, [opt.fit]);
  const obj = useMemo(() => {
    const src = scene.clone(true);
    src.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mat;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, mat]);

  const [w, h, d] = opt.dims;
  if (opt.fit === "footprint") {
    const s = Math.min(f.w / w, f.d / d);
    return <primitive object={obj} scale={s} />;
  }
  if (opt.fit === "seat") {
    // bidet seat rides on the procedural bowl
    const s = (f.w * 0.8) / w;
    return <primitive object={obj} position={[0, 0.52, 0.06]} scale={s} />;
  }
  if (opt.fit === "head") {
    // display scale (~0.24 m) so the swap reads clearly; hangs at the top
    const s = 0.24 / Math.max(w, h, d);
    return <primitive object={obj} position={[0, f.h - h * s - 0.02, 0]} scale={s} />;
  }
  if (opt.fit === "basinTop") {
    // sink bowl sits on the procedural basin counter (~0.86 m)
    const s = Math.min((f.w * 0.55) / w, (f.d * 0.55) / d);
    return <primitive object={obj} position={[0, 0.86, 0]} scale={s} />;
  }
  if (opt.fit === "faucet") {
    // tap mounts at the back edge of the counter
    const s = 0.26 / Math.max(w, h, d);
    return <primitive object={obj} position={[0, 0.86, -f.d / 2 + 0.1]} scale={s} />;
  }
  // screen: replace the side glass wall, fit height then width
  const s = Math.min((f.h - 0.1) / h, f.d / w);
  return <primitive object={obj} position={[f.w / 2 - 0.02, 0.1, 0]} rotation={[0, Math.PI / 2, 0]} scale={s} />;
}

function FixtureMesh({ f, labels, model }: { f: MetreFixture; labels: boolean; model: string }) {
  const opt = optionById(model === PROCEDURAL ? undefined : model);
  // AI-picked variant tags tint the procedural body when the variant has no
  // GLB yet; a GLB-backed variant renders via ModelPart instead.
  const finish = useMemo(() => finishForTags(opt?.variant.tags), [opt]);
  const body = useMemo(
    () => (finish ? finishMat(finish.color, finish.metal) : ceramic()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [finish?.color, finish?.metal]
  );
  const dark = useMemo(() => ceramic("#3a3a38"), []);
  const charcoal = useMemo(() => std("#232323", 0.7), []);
  const glass = useMemo(() => glassMat(), []);
  const metal = useMemo(() => chrome(), []);
  const labelY = f.h + (f.glass ? 0.35 : 0.25);
  const glbOpt = opt && opt.glb ? opt : null;

  const bathtub = f.kind === "Bathtub" && glbOpt?.fit === "footprint" ? (
    <ModelPart opt={glbOpt} f={f} />
  ) : (
    <>
      <RoundedBox args={[f.w, 0.58, f.d]} radius={0.09} smoothness={4} position={[0, 0.3, 0]} material={body} castShadow receiveShadow />
      <mesh position={[0, 0.47, 0]} material={dark} receiveShadow>
        <boxGeometry args={[f.w - 0.24, 0.1, f.d - 0.24]} />
      </mesh>
    </>
  );

  const toilet = (() => {
    if (f.kind !== "Toilet") return null;
    // Seat is an attached part: it rides on the WC whether the bowl is a
    // footprint GLB or procedural (legacy saves kept the seat in `model`).
    const seatOpt = (f.seat ? optionById(f.seat) : null) ?? (glbOpt?.fit === "seat" ? glbOpt : null);
    const seatGlb = seatOpt && seatOpt.glb ? seatOpt : null;
    if (glbOpt?.fit === "footprint")
      return (
        <>
          <ModelPart opt={glbOpt} f={f} />
          {seatGlb && <ModelPart opt={seatGlb} f={f} />}
        </>
      );
    return (
      <>
        <RoundedBox args={[f.w, 0.42, f.d]} radius={0.1} smoothness={4} position={[0, 0.28, 0.04]} material={body} castShadow receiveShadow />
        <mesh position={[0, 0.62, -f.d / 2 + 0.12]} material={body} castShadow>
          <boxGeometry args={[f.w * 0.9, 0.5, 0.18]} />
        </mesh>
        {seatGlb && <ModelPart opt={seatGlb} f={f} />}
      </>
    );
  })();

  const shower = f.kind === "Shower" ? (
    (() => {
      const gh = f.h - 0.1;
      const headOpt = glbOpt?.fit === "head" ? glbOpt : null;
      // A footprint-fit model on a shower is the base pan itself.
      const baseOpt = glbOpt?.fit === "footprint" ? glbOpt : null;
      // Enclosure is an attached part with its own id (legacy saves kept a
      // screen/door in `model`, which still resolves as fallback).
      const screenOpt = (f.screen ? optionById(f.screen) : null) ?? (glbOpt?.fit === "screen" ? glbOpt : null);
      const screenGlb = screenOpt && screenOpt.glb ? screenOpt : null;
      return (
        <>
          {baseOpt ? (
            <ModelPart opt={baseOpt} f={f} />
          ) : (
            <mesh position={[0, 0.05, 0]} material={body} castShadow receiveShadow>
              <boxGeometry args={[f.w, 0.1, f.d]} />
            </mesh>
          )}
          <mesh position={[0, 0.1 + gh / 2, -f.d / 2 + 0.02]} material={glass}>
            <boxGeometry args={[f.w, gh, 0.02]} />
          </mesh>
          {screenGlb ? (
            <ModelPart opt={screenGlb} f={f} />
          ) : (
            <mesh position={[f.w / 2 - 0.02, 0.1 + gh / 2, 0]} material={glass}>
              <boxGeometry args={[0.02, gh, f.d]} />
            </mesh>
          )}
          {headOpt ? (
            <ModelPart opt={headOpt} f={f} />
          ) : (
            <>
              <mesh position={[0, f.h + 0.02, 0]} material={metal} castShadow>
                <cylinderGeometry args={[0.16, 0.16, 0.025, 28]} />
              </mesh>
              <mesh position={[0, (f.h + 0.1) / 2 + 0.05, -f.d / 2 + 0.02]} material={metal}>
                <cylinderGeometry args={[0.015, 0.015, f.h, 10]} />
              </mesh>
            </>
          )}
        </>
      );
    })()
  ) : null;

  // Basin: pedestal + counter always procedural. The AI-matched sink sits on
  // the counter (GLB when provided, tinted bowl otherwise) and the matched
  // faucet mounts at the back edge (GLB or chrome stand-in).
  const basin = (() => {
    if (f.kind !== "Basin" && f.kind !== "Vanity") return null;
    const sinkOpt = glbOpt?.fit === "basinTop" ? glbOpt : null;
    const fp = faucetForBasin(f.faucet);
    const fpFinish = finishForTags(fp?.variant.tags);
    const faucetMat = fpFinish?.metal
      ? finishMat(fpFinish.color, true)
      : fpFinish
        ? ceramic(fpFinish.color)
        : metal;
    const bowlMat = sinkOpt ? body : ceramic(finish?.color ?? CERAMIC);
    return (
      <>
        {f.kind === "Vanity" ? (
          <mesh position={[0, 0.42, 0]} material={charcoal} castShadow receiveShadow>
            <boxGeometry args={[f.w, 0.8, f.d]} />
          </mesh>
        ) : (
          <mesh position={[0, 0.4, 0]} material={body} castShadow receiveShadow>
            <boxGeometry args={[f.w * 0.5, 0.8, f.d * 0.6]} />
          </mesh>
        )}
        <RoundedBox args={[f.w, 0.16, f.d]} radius={0.06} smoothness={4} position={[0, 0.86, 0]} material={body} castShadow receiveShadow />
        {sinkOpt ? (
          <ModelPart opt={sinkOpt} f={f} />
        ) : (
          <>
            <RoundedBox args={[f.w * 0.5, 0.12, f.d * 0.48]} radius={0.05} smoothness={4} position={[0, 0.95, 0.02]} material={bowlMat} castShadow receiveShadow />
            <mesh position={[0, 0.94, 0.02]} material={dark} receiveShadow>
              <boxGeometry args={[f.w * 0.4, 0.06, f.d * 0.36]} />
            </mesh>
          </>
        )}
        {fp?.glb ? (
          <ModelPart opt={{ ...fp, glb: fp.glb }} f={f} />
        ) : fp || f.faucet ? (
          <group position={[0, 0.94, -f.d / 2 + 0.09]}>
            <mesh position={[0, 0.11, 0]} material={faucetMat} castShadow>
              <cylinderGeometry args={[0.014, 0.016, 0.22, 14]} />
            </mesh>
            <mesh position={[0, 0.22, 0.055]} rotation={[Math.PI / 2, 0, 0]} material={faucetMat} castShadow>
              <cylinderGeometry args={[0.012, 0.012, 0.13, 12]} />
            </mesh>
          </group>
        ) : null}
      </>
    );
  })();
  return (
    <group position={[f.cx, 0, f.cz]} rotation={[0, THREE.MathUtils.degToRad(f.rot ?? 0), 0]}>
      {/* soft grounding shadow, re-baked whenever the model swaps */}
      <ContactShadows
        key={`${model}|${f.faucet ?? ""}|${f.seat ?? ""}|${f.screen ?? ""}`}
        position={[0, 0.008, 0]}
        scale={[f.w + 1.2, f.d + 1.2]}
        far={1.4}
        resolution={256}
        color="#000000"
        opacity={0.7}
        blur={2.2}
        frames={2}
      />
      {shower}
      {bathtub}
      {toilet}
      {basin}
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

// Movable decor placed on the 2D canvas. Renders the scanned GLB (monochrome
// override, footprint-fitted) once assets arrive; until then a satin fallback
// box at the planner position — stacked on y0 when dropped over a fixture.
function DecorGlb({ glb, f }: { glb: string; f: MetreFixture }) {
  const { scene } = useGLTF(glb);
  const mat = useMemo(() => ceramic(), []);
  const obj = useMemo(() => {
    const src = scene.clone(true);
    src.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = mat;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, mat]);
  const s = useMemo(() => {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    return Math.min(f.w / (size.x || 1), f.d / (size.z || 1));
  }, [obj, f.w, f.d]);
  // Group already sits at y0 — the primitive stays at local origin so
  // stacked decor lands exactly on the fixture surface, not double height.
  return <primitive object={obj} scale={s} position={[0, 0, 0]} />;
}

function DecorMesh({ f, labels }: { f: MetreFixture; labels: boolean }) {
  const opt = decorById(f.decorId);
  const body = useMemo(() => ceramic("#cfcdc6"), []);
  const y0 = f.y0 ?? 0;
  return (
    <group position={[f.cx, y0, f.cz]} rotation={[0, THREE.MathUtils.degToRad(f.rot ?? 0), 0]}>
      <ContactShadows
        position={[0, 0.008, 0]}
        scale={[f.w + 0.8, f.d + 0.8]}
        far={1.2}
        resolution={256}
        color="#000000"
        opacity={0.6}
        blur={2.2}
        frames={2}
      />
      {opt?.glb ? (
        <DecorGlb glb={opt.glb} f={f} />
      ) : (
        <RoundedBox args={[f.w, f.h, f.d]} radius={0.03} smoothness={4} position={[0, f.h / 2, 0]} material={body} castShadow receiveShadow />
      )}
      {labels && (
        <Html center position={[0, f.h + 0.2, 0]} style={{ pointerEvents: "none" }}>
          <div style={{ fontSize: 11, color: "#fff", background: "rgba(0,0,0,0.55)", border: "1px dashed #999", borderRadius: 9999, padding: "2px 10px", whiteSpace: "nowrap" }}>
            {opt?.glyph ?? "Decor"}
          </div>
        </Html>
      )}
    </group>
  );
}

function SectionUpdater({ cutaway, registry }: { cutaway: boolean; registry: Registry }) {  const { camera, controls } = useThree();
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
  room, fixtures, openings, cutaway, labels, spin, controlsRef, registry, models, lamp, decor,
}: {
  room: RoomDims;
  fixtures: MetreFixture[];
  openings: MetreOpening[];
  cutaway: boolean;
  labels: boolean;
  spin: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  registry: Registry;
  models: Record<number, string>;
  lamp: LampSpec | null;
  decor: boolean;
}) {
  const tile = useTileTexture(room.w, room.h);
  const maxR = Math.max(room.w, room.h);
  // Only what the user placed on the 2D canvas renders — no default staging.
  const solids = fixtures.filter((f) => !f.decorId);
  const placedDecor = fixtures.filter((f) => f.decorId);

  return (
    <>
      <ambientLight intensity={0.5} />
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
      {/* rim from behind (default cam faces +z): brightens silhouette edges
          so porcelain reads as a shape, not a grey blob, on the black void */}
      <directionalLight position={[1, 3.2, -8]} intensity={1.6} color="#eef2ff" />
      <Environment resolution={256}>
        <Lightformer intensity={3.2} position={[0, 5, 0]} rotation-x={Math.PI / 2} scale={[9, 9, 1]} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[6, 2, 1]} color={CREAM} />
        <Lightformer intensity={0.8} position={[5, 2, 2]} rotation-y={-Math.PI / 2} scale={[6, 3, 1]} color="#dfe4ee" />
        {/* dim all-around cards so metals never sample pure black */}
        <Lightformer intensity={0.35} position={[0, 2, -6]} scale={[10, 4, 1]} color="#cfd4de" />
        <Lightformer intensity={0.35} position={[0, 2, 6]} rotation-y={Math.PI} scale={[10, 4, 1]} color="#cfd4de" />
        <Lightformer intensity={0.25} position={[0, -2, 0]} rotation-x={-Math.PI / 2} scale={[8, 8, 1]} color="#8a8f99" />
      </Environment>

      {/* floor slab + tile inlay border */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[room.w + 0.5, 0.1, room.h + 0.5]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      {/* wet-look floor: tile grid + soft mirror reflections (the single
          biggest step away from the flat grey render — fixtures touch down) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]} receiveShadow>
        <planeGeometry args={[room.w, room.h]} />
        <MeshReflectorMaterial
          resolution={512}
          mixBlur={6}
          mixStrength={2.6}
          blur={[320, 90]}
          mirror={0.35}
          map={tile}
          roughness={0.7}
          metalness={0.1}
          color="#ffffff"
          depthScale={0}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.2}
        />
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
      {solids.map((f) => (
        <FixtureMesh key={f.id} f={f} labels={labels} model={models[f.id] ?? PROCEDURAL} />
      ))}
      {decor && placedDecor.map((f) => (
        <DecorMesh key={f.id} f={f} labels={labels} />
      ))}
      {lamp && <PendantLamp room={room} lamp={lamp} />}

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

function TrayButton({ selected, title, onPick, thumb, thumbLabel, label, sub }: {
  selected: boolean; title: string; onPick: () => void; thumb?: string; thumbLabel: string; label: string; sub?: string;
}) {
  return (
    <button
      onClick={onPick}
      title={sub ? `${title} — ${sub}` : title}
      className={`overflow-hidden rounded-[10px] border text-left transition-colors ${selected ? "border-[#f5f5f0]" : "border-[#333] hover:border-[#666]"}`}
    >
      {thumb ? (
        <img src={thumb} alt={label} width={96} height={72} className="block h-[72px] w-[96px] object-cover" loading="lazy" />
      ) : (
        <span className="flex h-[72px] w-[96px] items-center justify-center bg-gradient-to-br from-[#262626] to-[#0c0c0c] text-[11px] uppercase tracking-[0.08em] text-[#999]">
          {thumbLabel}
        </span>
      )}
      <span className="block max-w-[96px] px-2 pt-1 text-[11px] leading-tight">
        <span className="block truncate text-[#999]">{label}</span>
        {sub && (
          <span className="block truncate pb-1 text-[9px] uppercase tracking-[0.08em] text-[#666]">{sub}</span>
        )}
        {!sub && <span className="block pb-1" />}
      </span>
    </button>
  );
}

const variantTitle = (m: ModelOption) =>
  `${m.variant.tags.join(" · ")} — ₹${m.variant.price_inr.toLocaleString("en-IN")}${m.glb ? "" : " (procedural until GLB lands)"}`;

// Single consolidated grid per fit-group. Subtypes (Rainheads vs
// Handshowers…) render as a small label on each card instead of their own
// full-width header row, so singleton subs don't sprawl vertically.
function OptionButtons({ items, selectedId, onPick }: {
  items: ModelOption[]; selectedId: string; onPick: (id: string) => void;
}) {
  const tagFallback = (m: ModelOption) =>
    m.variant.tags.find((t) => !["minimal", "modern", "zen", "classic", "luxury", "heritage", "bold"].includes(t)) ?? m.variant.kind;
  const sorted = [...items].sort(
    (a, b) => (a.variant.sub ?? "").localeCompare(b.variant.sub ?? "") || a.label.localeCompare(b.label)
  );
  return (
    <>
      {sorted.map((m) => (
        <TrayButton key={m.id} selected={selectedId === m.id} title={variantTitle(m)} onPick={() => onPick(m.id)}
          thumb={m.thumb || undefined} thumbLabel={tagFallback(m)} label={m.label} sub={m.variant.sub} />
      ))}
    </>
  );
}

function SwapTray({
  fixtures, models, onModelChange, onFaucetChange, onSeatChange, onScreenChange,
}: {
  fixtures: MetreFixture[];
  models: Record<number, string>;
  onModelChange: (id: number, model: string) => void;
  onFaucetChange: (id: number, faucet: string) => void;
  onSeatChange: (id: number, seat: string) => void;
  onScreenChange: (id: number, screen: string) => void;
}) {
  const swappable = fixtures.filter((f) => optionsForKind(f.kind).length > 0);
  if (swappable.length === 0) return null;
  const taps = modelOptions().filter((m) => m.variant.kind === "Faucet");
  return (
    <div className="mt-6 border-t border-[#333] pt-6">
      <p className="label-caps text-[#999]">Swap models — catalogue variants (AI picks seeded)</p>
      {swappable.map((f) => {
        const sel = models[f.id] ?? PROCEDURAL;
        const kindOpts = optionsForKind(f.kind);
        return (
          <div key={f.id} className="mt-4">
            <p className="text-[14px] text-white/80">{f.kind}</p>
            {f.kind === "Basin" ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  <TrayButton selected={sel === PROCEDURAL} title="Studio procedural basin" onPick={() => onModelChange(f.id, PROCEDURAL)} thumbLabel="STUDIO" label="Procedural" sub="Studio" />
                  <OptionButtons items={kindOpts} selectedId={sel} onPick={(id) => onModelChange(f.id, id)} />
                </div>
                <p className="mt-2 text-[12px] text-[#999]">Tap — swaps without changing the basin</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <TrayButton selected={!f.faucet} title="No tap" onPick={() => onFaucetChange(f.id, "")} thumbLabel="NONE" label="No tap" />
                  <OptionButtons items={taps} selectedId={f.faucet ?? ""} onPick={(id) => onFaucetChange(f.id, id)} />
                </div>
              </>
            ) : f.kind === "Shower" ? (
              <>
                <p className="mt-2 text-[12px] uppercase tracking-[0.08em] text-[#666]">
                  Head — {kindOpts.filter((m) => m.variant.fit === "head").length + 1} options
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <TrayButton selected={sel === PROCEDURAL} title="Studio procedural head" onPick={() => onModelChange(f.id, PROCEDURAL)} thumbLabel="STUDIO" label="Procedural" sub="Studio" />
                  <OptionButtons items={kindOpts.filter((m) => m.variant.fit === "head")} selectedId={sel} onPick={(id) => onModelChange(f.id, id)} />
                </div>
                <p className="mt-3 text-[12px] uppercase tracking-[0.08em] text-[#666]">
                  Enclosure — swaps without changing the head · {kindOpts.filter((m) => m.variant.fit === "screen").length + 1} options
                </p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <TrayButton selected={!f.screen} title="Studio procedural glass" onPick={() => onScreenChange(f.id, "")} thumbLabel="GLASS" label="Procedural" sub="Studio" />
                  <OptionButtons items={kindOpts.filter((m) => m.variant.fit === "screen")} selectedId={f.screen ?? ""} onPick={(id) => onScreenChange(f.id, id)} />
                </div>
              </>
            ) : f.kind === "Toilet" ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  <TrayButton selected={sel === PROCEDURAL} title="Studio procedural WC" onPick={() => onModelChange(f.id, PROCEDURAL)} thumbLabel="STUDIO" label="Procedural" sub="Studio" />
                  <OptionButtons items={kindOpts.filter((m) => m.variant.fit === "footprint")} selectedId={sel} onPick={(id) => onModelChange(f.id, id)} />
                </div>
                <p className="mt-2 text-[12px] text-[#999]">Seat — swaps without changing the WC</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <TrayButton selected={!f.seat} title="No bidet seat" onPick={() => onSeatChange(f.id, "")} thumbLabel="NONE" label="No seat" />
                  <OptionButtons items={kindOpts.filter((m) => m.variant.fit === "seat")} selectedId={f.seat ?? ""} onPick={(id) => onSeatChange(f.id, id)} />
                </div>
              </>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <TrayButton selected={sel === PROCEDURAL} title="Studio procedural" onPick={() => onModelChange(f.id, PROCEDURAL)} thumbLabel="STUDIO" label="Procedural" sub="Studio" />
                <OptionButtons items={kindOpts} selectedId={sel} onPick={(id) => onModelChange(f.id, id)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RoomCanvas({
  room, fixtures, openings, models, onModelChange, onFaucetChange, onSeatChange, onScreenChange,
}: {
  room: RoomDims;
  fixtures: MetreFixture[];
  openings: MetreOpening[];
  models: Record<number, string>;
  onModelChange: (id: number, model: string) => void;
  onFaucetChange: (id: number, faucet: string) => void;
  onSeatChange: (id: number, seat: string) => void;
  onScreenChange: (id: number, screen: string) => void;
}) {
  const [cutaway, setCutaway] = useState(true);
  const [labels, setLabels] = useState(true);
  const [spin, setSpin] = useState(false);
  const [lampId, setLampId] = useState<string | null>("warm");
  const [decor, setDecor] = useState(true);
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
      <div style={{ height: 560, borderRadius: 10, overflow: "hidden", background: "#000", position: "relative" }}>
        {/* PCFSoft (native): wide filtered edges without drei's PCSS patch,
            which assumed RGBA-packed shadow maps removed in three ≥ r165. */}
        <Canvas
          shadows="soft"
          dpr={[1, 2]}
          camera={{ position: [4.6, 3.8, 6.2], fov: 42 }}
          gl={{ antialias: true, localClippingEnabled: true }}
          onCreated={({ gl }) => { gl.toneMappingExposure = 1.28; }}
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
              models={models}
              lamp={lampById(lampId)}
              decor={decor}
            />
          </Suspense>
        </Canvas>
        {/* cinematic vignette — pulls the eye to the lit centre, darkens the
            flat horizon where walls meet void */}
        <div
          aria-hidden
          style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            background: "radial-gradient(120% 95% at 50% 42%, transparent 55%, rgba(0,0,0,0.55) 100%)",
          }}
        />
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
      <div className="mt-6 border-t border-[#333] pt-6">
        <p className="label-caps text-[#999]">Ambience — pendant light + decor</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setLampId(null)}
            className={`rounded-[9999px] border px-4 py-2 text-[13px] transition-colors ${lampId === null ? "border-[#f5f5f0] text-white" : "border-[#333] text-[#999] hover:border-[#666]"}`}
          >
            Light off
          </button>
          {LAMPS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLampId(l.id)}
              title={l.label}
              aria-label={l.label}
              className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${lampId === l.id ? "border-[#f5f5f0]" : "border-[#333] hover:border-[#666]"}`}
            >
              <span className="h-5 w-5 rounded-full" style={{ background: l.color, boxShadow: lampId === l.id ? `0 0 12px ${l.color}` : "none" }} />
            </button>
          ))}
          <button
            onClick={() => setDecor((d) => !d)}
            className={`rounded-[9999px] border px-4 py-2 text-[13px] transition-colors ${decor ? "border-[#f5f5f0] text-white" : "border-[#333] text-[#999] hover:border-[#666]"}`}
          >
            Decor {decor ? "on" : "off"}
          </button>
        </div>
        <p className="mt-2 text-[13px] text-[#999]">
          {lampId ? `${LAMPS.find((l) => l.id === lampId)?.label} pendant on.` : "Pendant off — key light only."}{" "}
          {fixtures.some((f) => f.decorId)
            ? `${fixtures.filter((f) => f.decorId).length} placed decor piece${fixtures.filter((f) => f.decorId).length === 1 ? "" : "s"} from your 2D plan${decor ? "." : " (hidden)."}`
            : `No decor placed yet — add some on the 2D canvas.`}
        </p>
      </div>
      <SwapTray fixtures={fixtures} models={models} onModelChange={onModelChange} onFaucetChange={onFaucetChange} onSeatChange={onSeatChange} onScreenChange={onScreenChange} />
    </div>
  );
}

useGLTF.preload("/models/door-plain.glb");
useGLTF.preload("/models/window-plain.glb");
useGLTF.preload("/models/21000-P5-plain.glb");
useGLTF.preload("/models/75790-plain.glb");
useGLTF.preload("/models/30754-PA-plain.glb");
useGLTF.preload("/models/22170-plain.glb");
useGLTF.preload("/models/13696-G-plain.glb");
useGLTF.preload("/models/707002-D3-plain.glb");
useGLTF.preload("/models/706008-L-plain.glb");
useGLTF.preload("/models/14800-plain.glb");
useGLTF.preload("/models/97100-4-plain.glb");
useGLTF.preload("/models/6366-plain.glb");
useGLTF.preload("/models/13688-plain.glb");
useGLTF.preload("/models/3493-plain.glb");
useGLTF.preload("/models/18751-plain.glb");
useGLTF.preload("/models/decor-plant-plain.glb");
useGLTF.preload("/models/decor-plant-pot-plain.glb");
useGLTF.preload("/models/decor-stool-plain.glb");
useGLTF.preload("/models/decor-towels-plain.glb");
