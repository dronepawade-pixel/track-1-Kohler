#!/usr/bin/env python3
"""OBJ -> Draco-compressed GLB for the Kohler viewer asset pipeline.

Usage:
  python3 tools/obj_to_draco_glb.py <in.obj> <out.glb> [--scale S | --width-m W]
                                     [--z-up | --y-up] [--no-draco]

- Normalizes axes to Y-up metres, centers footprint, drops base to y=0.
- Merges to ONE mesh/primitive (obj2gltf emits one primitive per face on
  3ds Max files, which defeats Draco) with welded vertices.
- Draco pass via `npx gltf-pipeline` (needs network once for the package).

Doors from 3ds Max are Z-up centimetres:  --scale 0.01
Blender front-elevation scans are already Y-up:  --y-up --width-m 1.2
"""
import argparse
import json
import os
import struct
import subprocess
import sys


def load(path):
    verts, normals, faces = [], [], []
    with open(path, "r", errors="replace") as f:
        for line in f:
            s = line.strip()
            if s.startswith("v "):
                verts.append([float(x) for x in s.split()[1:4]])
            elif s.startswith("vn "):
                normals.append([float(x) for x in s.split()[1:4]])
            elif s.startswith("f "):
                faces.append(s)
            # drop mtllib/usemtl (missing .mtl -> default material) and
            # smoothing groups (per-face groups defeat primitive merging)
    return verts, normals, faces


def normalize(verts, normals, scale, z_up):
    conv = [(x, z, -y) for x, y, z in verts] if z_up else list(verts)
    nrm = [(nx, nz, -ny) for nx, ny, nz in normals] if z_up else list(normals)
    xs = [p[0] for p in conv]
    ys = [p[1] for p in conv]
    zs = [p[2] for p in conv]
    cx, cz, by = (min(xs) + max(xs)) / 2, (min(zs) + max(zs)) / 2, min(ys)
    return [((x - cx) * scale, (y - by) * scale, (z - cz) * scale)
            for x, y, z in conv], nrm


def triangulate(faces):
    tris = []
    for s in faces:
        vs = []
        for p in s.split()[1:]:
            parts = p.split("/")
            vi = int(parts[0]) - 1
            ni = int(parts[2]) - 1 if len(parts) > 2 and parts[2] else -1
            vs.append((vi, ni))
        for i in range(1, len(vs) - 1):
            tris.append((vs[0], vs[i], vs[i + 1]))
    return tris


def pad(b, fill=b"\x00"):
    return b + fill * (-len(b) % 4)


def write_glb(verts, normals, tris, path):
    if not normals:
        normals = [(0.0, 0.0, 1.0)]
    weld, vp, np, idx = {}, [], [], []
    for tri in tris:
        for vi, ni in tri:
            key = (vi, ni)
            if key not in weld:
                weld[key] = len(vp)
                vp.append(verts[vi])
                np.append(normals[ni] if ni >= 0 else (0.0, 0.0, 1.0))
            idx.append(weld[key])
    pmin = [min(v[i] for v in vp) for i in range(3)]
    pmax = [max(v[i] for v in vp) for i in range(3)]
    nmin = [min(n[i] for n in np) for i in range(3)]
    nmax = [max(n[i] for n in np) for i in range(3)]
    use32 = len(vp) > 65535
    pbin = pad(b"".join(struct.pack("<3f", *v) for v in vp))
    nbin = pad(b"".join(struct.pack("<3f", *n) for n in np))
    ibin = pad(b"".join(struct.pack("<I" if use32 else "<H", i) for i in idx))
    gltf = {
        "asset": {"version": "2.0", "generator": "kohler-obj2glb"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "model"}],
        "meshes": [{"name": "model", "primitives": [{
            "attributes": {"POSITION": 0, "NORMAL": 1},
            "indices": 2, "material": 0}]}],
        "materials": [{"name": "mono", "pbrMetallicRoughness": {
            "baseColorFactor": [0.82, 0.82, 0.80, 1.0],
            "metallicFactor": 0.0, "roughnessFactor": 0.85}}],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(vp),
             "type": "VEC3", "min": pmin, "max": pmax},
            {"bufferView": 1, "componentType": 5126, "count": len(np),
             "type": "VEC3", "min": nmin, "max": nmax},
            {"bufferView": 2, "componentType": 5125 if use32 else 5123,
             "count": len(idx), "type": "SCALAR"}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": 0, "byteLength": len(pbin),
             "target": 34962},
            {"buffer": 0, "byteOffset": len(pbin), "byteLength": len(nbin),
             "target": 34962},
            {"buffer": 0, "byteOffset": len(pbin) + len(nbin),
             "byteLength": len(ibin), "target": 34963}],
        "buffers": [{"byteLength": len(pbin) + len(nbin) + len(ibin)}],
    }
    jbin = pad(json.dumps(gltf, separators=(",", ":")).encode(), b" ")
    total = 12 + 8 + len(jbin) + 8 + len(pbin) + len(nbin) + len(ibin)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jbin), 0x4E4F534A))
        f.write(jbin)
        f.write(struct.pack("<II", len(pbin) + len(nbin) + len(ibin),
                            0x004E4942))
        f.write(pbin + nbin + ibin)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--scale", type=float, default=1.0)
    ap.add_argument("--width-m", type=float, default=0.0,
                    help="uniform scale so bounding width becomes W metres")
    ap.add_argument("--z-up", action="store_true", default=True)
    ap.add_argument("--y-up", dest="z_up", action="store_false")
    ap.add_argument("--no-draco", action="store_true")
    a = ap.parse_args()
    verts, normals, faces = load(a.src)
    scale = a.scale
    if a.width_m:
        xs = [v[0] for v in verts]
        scale = a.width_m / (max(xs) - min(xs))
    verts_t, normals_t = normalize(verts, normals, scale, a.z_up)
    tris = triangulate(faces)
    tmp = a.dst if a.no_draco else a.dst + ".plain.glb"
    write_glb(verts_t, normals_t, tris, tmp)
    w = max(v[0] for v in verts_t) - min(v[0] for v in verts_t)
    h = max(v[1] for v in verts_t) - min(v[1] for v in verts_t)
    d = max(v[2] for v in verts_t) - min(v[2] for v in verts_t)
    print(f"dims: {w:.3f} x {h:.3f} x {d:.3f} m, {len(tris)} tris")
    if not a.no_draco:
        subprocess.run(["npx", "-y", "gltf-pipeline", "-i", tmp, "-o",
                        a.dst, "-d", "--draco.compressionLevel", "10"],
                       check=True)
        os.remove(tmp)
    print(f"wrote {a.dst} ({os.path.getsize(a.dst)/1024:.1f} KB)")


if __name__ == "__main__":
    main()
