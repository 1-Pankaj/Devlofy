"""Devlofy garden stage models — the authored source of truth.

Run inside the live Blender session (MCP `execute_blender_code`):

    exec(compile(open(r"tools/blender/garden_models.py", encoding="utf-8").read(), "garden_models.py", "exec"))

Builds five hand-crafted growth stages into the `Devlofy` collection and
exports one GLB per stage into `assets/models/garden-<stage>.glb`:

    seed -> sprout -> sapling -> young -> canopy

Conventions (docs/05-blender-pipeline.md)
-----------------------------------------
* metres, origin at the base of the trunk, +Z up (the exporter converts to +Y up)
* geometry is baked in mesh space; objects keep identity transforms so exported
  nodes carry no translation — the app places each model at the origin
* low-ish poly, theme palette, faint emissive only on the brightest leaf tone
* idempotent: re-running rebuilds the stages and re-exports the GLBs
"""

import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

REPO = Path(r"D:\Codeloom\Internal Projects\Devlofy")
EXPORT_DIR = REPO / "assets" / "models"
COLLECTION_NAME = "Devlofy"

STAGES = ("seed", "sprout", "sapling", "young", "canopy")
# Showroom layout so one `look` frames all five side by side.
LAYOUT = {name: ((i - 2) * 2.6, 2.6, 0.0) for i, name in enumerate(STAGES)}

D = math.radians

# ── palette (docs/04-design-language.md, docs/05-blender-pipeline.md) ─────────

PALETTE = {
    "bark": ("#6E5B4C", 0.90, None),
    "bark_dark": ("#4E4034", 0.92, None),
    "leaf_deep": ("#1E7B4E", 0.72, None),
    "leaf_mid": ("#2FA96C", 0.68, None),
    "leaf_bright": ("#3EE08F", 0.62, "#0E4A2A"),
    "soil": ("#33291F", 1.00, None),
    "stone": ("#57534C", 0.95, None),
    "grass": ("#1F6B45", 0.78, None),
}


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(srgb_to_linear(int(h[i : i + 2], 16) / 255.0) for i in (0, 2, 4))


def make_material(key: str):
    hexcolor, roughness, emissive = PALETTE[key]
    name = "Devlofy" + "".join(part.capitalize() for part in key.split("_"))
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    rgb = hex_rgb(hexcolor)
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    if emissive:
        e = bsdf.inputs.get("Emission Color") or bsdf.inputs.get("Emission")
        if e is not None:
            e.default_value = (*hex_rgb(emissive), 1.0)
        s = bsdf.inputs.get("Emission Strength")
        if s is not None:
            s.default_value = 1.0
    mat.diffuse_color = (*rgb, 1.0)  # viewport display colour for `look`
    return mat


MATS = {key: make_material(key) for key in PALETTE}

# ── collection ────────────────────────────────────────────────────────────────

def get_collection():
    col = bpy.data.collections.get(COLLECTION_NAME)
    if col is None:
        col = bpy.data.collections.new(COLLECTION_NAME)
        bpy.context.scene.collection.children.link(col)
    return col


COL = get_collection()

# ── geometry helpers ──────────────────────────────────────────────────────────

def _new_faces(verts):
    return {f for v in verts for f in v.link_faces}


def _place(bm, verts, center, scale, rot):
    m = (
        Matrix.Translation(Vector(center))
        @ Euler(rot, "XYZ").to_matrix().to_4x4()
        @ Matrix.Diagonal((scale[0], scale[1], scale[2], 1.0))
    )
    bmesh.ops.transform(bm, matrix=m, verts=verts)


def blob(bm, slot, center, radius, scale=(1, 1, 1), rot=(0, 0, 0),
         bump=0.09, freq=1.7, seed=0.0, smooth=True, segments=10, rings=7):
    """A bumpy ellipsoid — the foliage clump / organic mass primitive."""
    ret = bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings, radius=1.0)
    verts = ret["verts"]
    faces = _new_faces(verts)
    off = Vector((seed, seed * 1.7, seed * 2.3))
    for v in verts:
        v.co *= 1.0 + noise.noise(v.co * freq + off) * bump
    _place(bm, verts, center, (radius * scale[0], radius * scale[1], radius * scale[2]), rot)
    for f in faces:
        f.material_index = slot
        f.smooth = smooth


def pebble(bm, slot, center, radius, scale=(1, 0.82, 0.62), rot=(0, 0, 0), seed=1.0):
    ret = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    verts = ret["verts"]
    faces = _new_faces(verts)
    off = Vector((seed * 3.1, seed * 1.3, seed * 2.1))
    for v in verts:
        v.co *= 1.0 + noise.noise(v.co * 2.2 + off) * 0.18
    # Sunk slightly into the ground so it reads as half-buried.
    z = center[2] - radius * scale[2] * 0.35
    _place(bm, verts, (center[0], center[1], z), (radius * scale[0], radius * scale[1], radius * scale[2]), rot)
    for f in faces:
        f.material_index = slot
        f.smooth = False


def grass_tuft(bm, slot, center, scale=1.0, blades=6, seed=0):
    rnd = random.Random(seed)
    for _ in range(blades):
        ang = rnd.uniform(0, math.tau)
        tilt = rnd.uniform(0.28, 0.62)
        length = rnd.uniform(0.05, 0.085) * scale
        off = rnd.uniform(0.004, 0.014) * scale
        ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=4,
                                    radius1=0.011 * scale, radius2=0.0012, depth=length)
        verts = ret["verts"]
        faces = _new_faces(verts)
        m = (
            Matrix.Translation(Vector(center) + Vector((math.cos(ang) * off, math.sin(ang) * off, 0.0)))
            @ Matrix.Rotation(ang, 4, "Z")
            @ Euler((0.0, tilt, 0.0), "XYZ").to_matrix().to_4x4()
            @ Matrix.Translation((0.0, 0.0, length * 0.5))
        )
        bmesh.ops.transform(bm, matrix=m, verts=verts)
        for f in faces:
            f.material_index = slot
            f.smooth = False


def mushroom(bm, slot_stem, slot_cap, center, height=0.03, cap=0.02, tilt=0.14):
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=7,
                                radius1=0.0075, radius2=0.005, depth=height)
    stem_verts = ret["verts"]
    stem_faces = _new_faces(stem_verts)
    rot = Euler((0.0, tilt, 0.0), "XYZ").to_matrix().to_4x4()
    m_stem = Matrix.Translation(Vector(center)) @ rot @ Matrix.Translation((0.0, 0.0, height * 0.5))
    bmesh.ops.transform(bm, matrix=m_stem, verts=stem_verts)
    for f in stem_faces:
        f.material_index = slot_stem
        f.smooth = False
    # Cap: squashed sphere on top of the stem.
    cap_verts, cap_faces = _blob_raw(bm)
    m_cap = (
        Matrix.Translation(Vector(center)) @ rot @ Matrix.Translation((0.0, 0.0, height))
        @ Matrix.Diagonal((cap, cap, cap * 0.55, 1.0))
    )
    bmesh.ops.transform(bm, matrix=m_cap, verts=cap_verts)
    for f in cap_faces:
        f.material_index = slot_cap
        f.smooth = True


def _blob_raw(bm):
    ret = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=1.0)
    verts = ret["verts"]
    return verts, _new_faces(verts)


def mound(bm, slot, center, radius, squash=0.5, bump=0.16, seed=0.0):
    blob(bm, slot, (center[0], center[1], center[2] - radius * squash * 0.30),
         radius, scale=(1.12, 1.02, squash), bump=bump, freq=2.6, seed=seed,
         segments=12, rings=9)


def lens(bm, slot, center, radius, scale=(1.0, 0.30, 0.62), rot=(0, 0, 0), seed=0.0):
    """A leaf: flattened lens-shaped blob."""
    blob(bm, slot, center, radius, scale=scale, rot=rot, bump=0.05, freq=2.2,
         seed=seed, segments=10, rings=6)


# ── curved limbs via the skin modifier ────────────────────────────────────────

def smooth_chain(points, samples=6):
    """Catmull-Rom through [(x, y, z, r), ...] -> [(Vector, r), ...]."""
    pts = [Vector(p[:3]) for p in points]
    rs = [p[3] for p in points]
    if len(pts) == 2:
        return [(pts[0].lerp(pts[1], i / samples), rs[0] + (rs[1] - rs[0]) * i / samples)
                for i in range(samples + 1)]

    def cr(p0, p1, p2, p3, t):
        return 0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t
                      + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t ** 3)

    out = []
    n = len(pts)
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[i + 1]
        r1, r2 = rs[i], rs[i + 1]
        last = i == n - 2
        for j in range(samples + (1 if last else 0)):
            t = j / samples
            co = cr(p0, p1, p2, p3, t)
            out.append((co, max(r1 + (r2 - r1) * t, 0.0015)))
    return out


def add_limbs(bm, slot, chains, samples=6, subsurf=1, smooth=True):
    """Tapered organic branches from a set of control-point chains."""
    verts, edges, radii, index = [], [], [], {}
    for chain in chains:
        ids = []
        for co, r in smooth_chain(chain, samples):
            key = (round(co.x, 5), round(co.y, 5), round(co.z, 5))
            i = index.get(key)
            if i is None:
                i = len(verts)
                index[key] = i
                verts.append(tuple(co))
                radii.append(r)
            else:
                radii[i] = max(radii[i], r)
            ids.append(i)
        edges.extend((ids[k], ids[k + 1]) for k in range(len(ids) - 1))

    me = bpy.data.meshes.new("_limbs")
    me.from_pydata(verts, edges, [])
    me.validate()
    ob = bpy.data.objects.new("_limbs", me)
    COL.objects.link(ob)
    skin = ob.modifiers.new("Skin", type="SKIN")
    skin.use_smooth_shade = True
    layer = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        layer[i].radius = (r, r)
    sub = ob.modifiers.new("Sub", type="SUBSURF")
    sub.levels = subsurf
    sub.render_levels = subsurf
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me_eval = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    for p in me_eval.polygons:
        p.material_index = slot
        p.use_smooth = smooth
    bm.from_mesh(me_eval)
    bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.meshes.remove(me)
    bpy.data.meshes.remove(me_eval)


# ── stage builders ────────────────────────────────────────────────────────────
# Each builder writes into a fresh bmesh. `S(key)` resolves the material slot.

def build_seed(bm, S):
    mound(bm, S("soil"), (0, 0, 0), 0.135, squash=0.46, seed=0.4)
    # Acorn pod leaning on the mound.
    rot = (D(16), D(6), D(20))
    blob(bm, S("bark"), (0.035, 0.012, 0.115), 0.065, scale=(1, 1, 1.18), rot=rot,
         bump=0.06, freq=2.0, seed=1.2)
    blob(bm, S("bark_dark"), (0.038, 0.013, 0.172), 0.072, scale=(1, 1, 0.62), rot=rot,
         bump=0.05, freq=2.0, seed=2.4)
    # The very first shoot, in front of the mound.
    blob(bm, S("leaf_bright"), (-0.066, 0.028, 0.056), 0.026, scale=(1, 0.32, 0.62),
         rot=(D(4), D(-38), D(168)), bump=0.04, seed=3.0)
    blob(bm, S("leaf_mid"), (-0.044, 0.032, 0.064), 0.02, scale=(1, 0.32, 0.62),
         rot=(D(4), D(-46), D(-10)), bump=0.04, seed=3.6)
    pebble(bm, S("stone"), (-0.105, -0.05, 0), 0.024, seed=4.1)
    pebble(bm, S("stone"), (0.12, -0.045, 0), 0.03, rot=(0, 0, D(40)), seed=4.6)
    pebble(bm, S("stone"), (0.085, 0.095, 0), 0.016, seed=5.2)
    grass_tuft(bm, S("grass"), (-0.03, -0.115, 0), scale=0.8, blades=5, seed=5.9)
    grass_tuft(bm, S("grass"), (0.135, 0.06, 0), scale=0.6, blades=4, seed=6.4)


def build_sprout(bm, S):
    mound(bm, S("soil"), (0, 0, 0), 0.14, squash=0.44, seed=1.1)
    add_limbs(bm, S("bark"), [[
        (0.0, 0.0, 0.015, 0.019),
        (0.015, 0.004, 0.125, 0.013),
        (-0.008, -0.006, 0.23, 0.011),
        (0.010, 0.004, 0.30, 0.008),
    ]], samples=6)
    # Two chunky cotyledons, one smaller fresh leaf between them.
    lens(bm, S("leaf_mid"), (-0.056, 0.016, 0.352), 0.095,
         rot=(D(4), D(-35), D(170)), seed=2.2)
    lens(bm, S("leaf_bright"), (0.062, -0.008, 0.356), 0.082,
         rot=(D(-6), D(-43), D(-12)), seed=3.1)
    lens(bm, S("leaf_bright"), (0.014, 0.02, 0.34), 0.036,
         rot=(D(-14), D(-72), D(70)), seed=3.9)
    pebble(bm, S("stone"), (-0.115, -0.035, 0), 0.026, seed=4.4)
    pebble(bm, S("stone"), (0.10, 0.055, 0), 0.018, seed=5.0)
    grass_tuft(bm, S("grass"), (-0.045, -0.125, 0), scale=1.1, blades=5, seed=5.6)


def build_sapling(bm, S):
    mound(bm, S("soil"), (0, 0, 0), 0.16, squash=0.46, seed=1.7)
    add_limbs(bm, S("bark"), [
        [(0, 0, 0, 0.062), (0.040, 0.012, 0.20, 0.044), (-0.025, -0.008, 0.44, 0.030),
         (0.022, 0.012, 0.64, 0.021), (0.006, 0.002, 0.80, 0.014)],
        [(-0.025, -0.008, 0.44, 0.020), (-0.15, 0.05, 0.58, 0.013), (-0.25, 0.075, 0.74, 0.007)],
        [(0.022, 0.012, 0.64, 0.019), (0.13, -0.04, 0.78, 0.011), (0.20, -0.06, 0.94, 0.006)],
        [(0.006, 0.002, 0.795, 0.012), (-0.03, 0.03, 0.91, 0.007), (-0.055, 0.05, 1.00, 0.004)],
        [(-0.15, 0.05, 0.58, 0.005), (-0.225, 0.105, 0.68, 0.0025)],
    ], samples=5)
    blob(bm, S("leaf_deep"), (-0.245, 0.075, 0.76), 0.105, seed=2.1)
    blob(bm, S("leaf_mid"), (-0.13, 0.02, 0.83), 0.085, seed=2.6)
    blob(bm, S("leaf_mid"), (0.215, -0.06, 0.955), 0.11, seed=3.1)
    blob(bm, S("leaf_deep"), (0.10, -0.03, 0.86), 0.08, seed=3.7)
    blob(bm, S("leaf_mid"), (-0.05, 0.05, 1.00), 0.085, seed=4.2)
    blob(bm, S("leaf_deep"), (0.015, 0.01, 0.84), 0.09, seed=4.8)
    blob(bm, S("leaf_bright"), (0.07, -0.02, 0.97), 0.05, seed=5.3)
    blob(bm, S("leaf_bright"), (-0.16, 0.07, 0.90), 0.045, seed=5.5)
    pebble(bm, S("stone"), (0.13, -0.07, 0), 0.024, seed=5.8)
    pebble(bm, S("stone"), (-0.11, 0.09, 0), 0.017, seed=6.1)
    grass_tuft(bm, S("grass"), (-0.12, -0.07, 0), scale=1.0, blades=6, seed=6.6)
    grass_tuft(bm, S("grass"), (0.09, 0.1, 0), scale=0.7, blades=4, seed=7.1)


def build_young(bm, S):
    mound(bm, S("soil"), (0, 0, 0), 0.22, squash=0.46, seed=2.3)
    add_limbs(bm, S("bark"), [
        [(0, 0, 0, 0.10), (0.055, 0.02, 0.36, 0.068), (-0.02, -0.015, 0.72, 0.045),
         (0.045, 0.02, 1.04, 0.030), (0.012, 0.008, 1.24, 0.019)],
        [(-0.02, -0.015, 0.68, 0.040), (-0.30, 0.10, 0.88, 0.024), (-0.50, 0.16, 1.06, 0.012)],
        [(-0.30, 0.10, 0.88, 0.016), (-0.33, 0.015, 1.07, 0.007)],
        [(0.04, 0.018, 1.00, 0.032), (0.33, -0.075, 1.16, 0.018), (0.52, -0.105, 1.34, 0.010)],
        [(0.33, -0.075, 1.16, 0.013), (0.30, -0.19, 1.32, 0.006)],
        [(0.012, 0.008, 1.22, 0.020), (-0.09, 0.10, 1.42, 0.011), (-0.15, 0.145, 1.56, 0.006)],
    ], samples=5)
    # Crown tiers (see build_canopy) — smaller, airier here.
    # Tier 1
    blob(bm, S("leaf_mid"), (-0.40, 0.13, 1.04), 0.15, seed=3.2)
    blob(bm, S("leaf_deep"), (-0.12, -0.03, 1.02), 0.13, seed=3.8)
    blob(bm, S("leaf_mid"), (0.16, 0.09, 1.04), 0.125, seed=4.3)
    blob(bm, S("leaf_deep"), (0.44, -0.08, 1.06), 0.12, seed=4.9)
    # Tier 2
    blob(bm, S("leaf_mid"), (-0.26, 0.14, 1.30), 0.13, seed=5.4)
    blob(bm, S("leaf_mid"), (0.04, -0.04, 1.28), 0.14, seed=6.0)
    blob(bm, S("leaf_mid"), (0.32, -0.11, 1.30), 0.11, seed=6.5)
    # Tier 3 + top
    blob(bm, S("leaf_mid"), (-0.11, 0.07, 1.51), 0.11, seed=7.1)
    blob(bm, S("leaf_mid"), (0.13, -0.03, 1.51), 0.095, seed=7.6)
    blob(bm, S("leaf_mid"), (-0.01, 0.02, 1.63), 0.075, seed=8.2)
    # Skirt
    blob(bm, S("leaf_deep"), (-0.30, 0.16, 0.90), 0.10, seed=8.7)
    blob(bm, S("leaf_deep"), (0.36, 0.02, 0.97), 0.09, seed=9.3)
    # Accents
    blob(bm, S("leaf_bright"), (-0.17, 0.05, 1.58), 0.05, seed=9.8)
    blob(bm, S("leaf_bright"), (0.16, -0.05, 1.55), 0.045, seed=10.4)
    blob(bm, S("leaf_bright"), (0.0, 0.04, 1.68), 0.042, seed=10.9)
    pebble(bm, S("stone"), (0.20, -0.12, 0), 0.03, seed=9.1)
    pebble(bm, S("stone"), (-0.17, 0.14, 0), 0.02, seed=9.6)
    grass_tuft(bm, S("grass"), (-0.19, -0.1, 0), scale=1.1, blades=6, seed=10.2)
    grass_tuft(bm, S("grass"), (0.13, 0.16, 0), scale=0.8, blades=5, seed=10.7)


def build_canopy(bm, S):
    mound(bm, S("soil"), (0, 0, 0), 0.28, squash=0.46, seed=3.9)
    add_limbs(bm, S("bark"), [
        [(0, 0, 0, 0.135), (0.075, 0.03, 0.40, 0.092), (-0.035, -0.02, 0.82, 0.058),
         (0.055, 0.03, 1.18, 0.038), (0.02, 0.012, 1.46, 0.024)],
        [(-0.035, -0.02, 0.78, 0.052), (-0.34, 0.14, 1.02, 0.031), (-0.54, 0.21, 1.22, 0.015)],
        [(-0.34, 0.14, 1.02, 0.022), (-0.42, 0.10, 1.34, 0.012), (-0.46, 0.08, 1.56, 0.006)],
        [(0.05, 0.028, 1.16, 0.038), (0.38, -0.09, 1.36, 0.023), (0.56, -0.12, 1.50, 0.011)],
        [(0.38, -0.09, 1.36, 0.017), (0.48, -0.16, 1.60, 0.008)],
        [(0.02, 0.012, 1.44, 0.022), (-0.08, 0.10, 1.68, 0.012), (-0.16, 0.14, 1.86, 0.006)],
        [(0.02, 0.015, 0.92, 0.034), (0.16, 0.33, 1.06, 0.019), (0.26, 0.46, 1.20, 0.009)],
    ], samples=5)
    # Crown built as horizontal tiers of overlapping clumps (cloud stack):
    # tier bottoms widest, sizes shrinking upward, edges scalloped.
    # Tier 1 (bottom, widest)
    blob(bm, S("leaf_mid"), (-0.52, 0.12, 1.30), 0.20, seed=4.6)
    blob(bm, S("leaf_deep"), (-0.18, -0.04, 1.28), 0.17, seed=5.1)
    blob(bm, S("leaf_mid"), (0.16, 0.10, 1.30), 0.155, seed=5.7)
    blob(bm, S("leaf_deep"), (0.49, -0.06, 1.32), 0.175, seed=6.1)
    # Tier 2
    blob(bm, S("leaf_mid"), (-0.36, 0.16, 1.55), 0.175, seed=6.8)
    blob(bm, S("leaf_mid"), (0.00, -0.02, 1.53), 0.195, seed=7.3)
    blob(bm, S("leaf_mid"), (0.34, -0.10, 1.55), 0.155, seed=7.9)
    # Tier 3 + top cap
    blob(bm, S("leaf_mid"), (-0.18, 0.08, 1.78), 0.145, seed=8.4)
    blob(bm, S("leaf_mid"), (0.14, -0.02, 1.78), 0.125, seed=9.0)
    blob(bm, S("leaf_mid"), (-0.02, 0.03, 1.92), 0.095, seed=9.5)
    # Skirt: two clumps hanging off the under-edge
    blob(bm, S("leaf_deep"), (-0.42, 0.18, 1.10), 0.12, seed=10.1)
    blob(bm, S("leaf_deep"), (0.10, 0.12, 1.12), 0.11, seed=10.6)
    # Back fills (depth)
    blob(bm, S("leaf_deep"), (0.08, 0.36, 1.30), 0.13, seed=11.2)
    blob(bm, S("leaf_deep"), (-0.20, 0.28, 1.52), 0.12, seed=11.7)
    # Small bright accents tucked into the top surface
    blob(bm, S("leaf_bright"), (-0.24, 0.06, 1.86), 0.06, seed=12.3)
    blob(bm, S("leaf_bright"), (0.18, -0.06, 1.84), 0.055, seed=12.8)
    blob(bm, S("leaf_bright"), (0.02, 0.06, 1.98), 0.05, seed=13.4)
    blob(bm, S("leaf_bright"), (-0.44, 0.10, 1.62), 0.05, seed=13.9)
    pebble(bm, S("stone"), (0.26, -0.16, 0), 0.034, seed=14.4)
    pebble(bm, S("stone"), (-0.22, 0.18, 0), 0.022, seed=14.9)
    pebble(bm, S("stone"), (-0.05, -0.26, 0), 0.018, seed=15.5)
    grass_tuft(bm, S("grass"), (-0.24, -0.13, 0), scale=1.2, blades=7, seed=16.0)
    grass_tuft(bm, S("grass"), (0.17, 0.20, 0), scale=0.9, blades=5, seed=16.6)
    mushroom(bm, S("bark_dark"), S("bark"), (-0.185, 0.05, 0.02), height=0.03, cap=0.019)
    mushroom(bm, S("bark_dark"), S("bark"), (-0.165, 0.075, 0.02), height=0.022, cap=0.013, tilt=0.28)


BUILDERS = {
    "seed": (build_seed, {}),
    "sprout": (build_sprout, {}),
    "sapling": (build_sapling, {}),
    "young": (build_young, {}),
    "canopy": (build_canopy, {}),
}


# ── assembly + export ─────────────────────────────────────────────────────────

def purge_old():
    for ob in [o for o in bpy.data.objects if o.name.startswith("garden-") or o.name == "_limbs"]:
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)


def build_stage(name):
    build_fn = BUILDERS[name][0]
    slots = []

    def S(key):
        mat = MATS[key]
        if mat not in slots:
            slots.append(mat)
        return slots.index(mat)

    bm = bmesh.new()
    build_fn(bm, S)
    me = bpy.data.meshes.new(f"garden-{name}")
    bm.to_mesh(me)
    bm.free()
    for mat in slots:
        me.materials.append(mat)
    ob = bpy.data.objects.new(f"garden-{name}", me)
    COL.objects.link(ob)
    return ob


def export_glb(ob, path):
    for other in bpy.context.view_layer.objects:
        other.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kwargs = {"filepath": str(path), "export_format": "GLB"}
    for key, value in {
        "use_selection": True,
        "export_apply": True,
        "export_animations": False,
        "export_yup": True,
        "export_extras": False,
    }.items():
        if key in props:
            kwargs[key] = value
    if "use_selection" not in props and "export_selected" in props:
        kwargs["export_selected"] = True
    bpy.ops.export_scene.gltf(**kwargs)


def main():
    purge_old()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    cube = bpy.data.objects.get("Cube")
    if cube is not None:
        cube.hide_set(True)  # default startup cube would occlude look() shots
    summary = []
    for name in STAGES:
        ob = build_stage(name)
        bpy.context.view_layer.update()
        path = EXPORT_DIR / f"garden-{name}.glb"
        export_glb(ob, path)  # exported at the origin, identity transform
        ob.location = LAYOUT[name]
        me = ob.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        summary.append(f"{name}: {len(me.vertices)} verts, {tris} tris, {path.stat().st_size // 1024} KB")
    bpy.context.view_layer.update()
    print("Devlofy garden build complete")
    print("\n".join(summary))


main()
