"""Devlofy garden props — small Blender-authored models for scene dressing.

Run inside the live Blender session (MCP `execute_blender_code`):

    exec(compile(open(r"tools/blender/garden_props.py", encoding="utf-8").read(), "garden_props.py", "exec"))

Exports one GLB per prop into `assets/models/props/`.
Same conventions as garden_models.py: metres, origin at the base, +Z up,
geometry baked in mesh space, idempotent.
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector, noise

REPO = Path(r"D:\Codeloom\Internal Projects\Devlofy")
EXPORT_DIR = REPO / "assets" / "models" / "props"
COLLECTION_NAME = "Devlofy"

D = math.radians

PALETTE = {
    "bark": ("#6E5B4C", 0.90, None),
    "bark_dark": ("#4E4034", 0.92, None),
    "leaf_deep": ("#1E7B4E", 0.72, None),
    "leaf_mid": ("#2FA96C", 0.68, None),
    "leaf_bright": ("#3EE08F", 0.62, "#0E4A2A"),
    "soil": ("#33291F", 1.00, None),
    "stone": ("#57534C", 0.95, None),
    "grass": ("#1F6B45", 0.78, None),
    "petal": ("#E9E6DA", 0.60, None),
    "ember": ("#C96A3F", 0.70, None),
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
    mat.diffuse_color = (*rgb, 1.0)
    return mat


MATS = {key: make_material(key) for key in PALETTE}

COL = bpy.data.collections.get(COLLECTION_NAME)
if COL is None:
    COL = bpy.data.collections.new(COLLECTION_NAME)
    bpy.context.scene.collection.children.link(COL)


# ── helpers (shared style with garden_models.py) ─────────────────────────────

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


def rock(bm, slot, center, radius, scale=(1, 0.85, 0.68), rot=(0, 0, 0), seed=1.0):
    ret = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
    verts = ret["verts"]
    faces = _new_faces(verts)
    off = Vector((seed * 3.1, seed * 1.3, seed * 2.1))
    for v in verts:
        v.co *= 1.0 + noise.noise(v.co * 2.2 + off) * 0.2
    z = center[2] - radius * scale[2] * 0.35
    _place(bm, verts, (center[0], center[1], z), (radius * scale[0], radius * scale[1], radius * scale[2]), rot)
    for f in faces:
        f.material_index = slot
        f.smooth = False


def grass_blades(bm, slot, center, scale=1.0, blades=8, seed=0, lean=0.5):
    import random
    rnd = random.Random(seed)
    for _ in range(blades):
        ang = rnd.uniform(0, math.tau)
        tilt = rnd.uniform(0.3, lean + 0.25)
        length = rnd.uniform(0.06, 0.1) * scale
        off = rnd.uniform(0.004, 0.016) * scale
        ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=4,
                                    radius1=0.012 * scale, radius2=0.0012, depth=length)
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


def mushroom(bm, slot_stem, slot_cap, center, height=0.03, cap=0.02, tilt=0.14, seed=0.0):
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
    ret2 = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=1.0)
    cap_verts = ret2["verts"]
    cap_faces = _new_faces(cap_verts)
    m_cap = (
        Matrix.Translation(Vector(center)) @ rot @ Matrix.Translation((0.0, 0.0, height))
        @ Matrix.Diagonal((cap, cap, cap * 0.55, 1.0))
    )
    bmesh.ops.transform(bm, matrix=m_cap, verts=cap_verts)
    for f in cap_faces:
        f.material_index = slot_cap
        f.smooth = True


def build_prop(name, build_fn):
    slots = []

    def S(key):
        mat = MATS[key]
        if mat not in slots:
            slots.append(mat)
        return slots.index(mat)

    bm = bmesh.new()
    build_fn(bm, S)
    me = bpy.data.meshes.new(f"prop-{name}")
    bm.to_mesh(me)
    bm.free()
    for mat in slots:
        me.materials.append(mat)
    ob = bpy.data.objects.new(f"prop-{name}", me)
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


# ── props ─────────────────────────────────────────────────────────────────────

def build_rock(bm, S):
    rock(bm, S("stone"), (0, 0, 0), 0.09, scale=(1.0, 0.85, 0.7), seed=1.3)


def build_rocks(bm, S):
    rock(bm, S("stone"), (0, 0, 0), 0.055, scale=(1.0, 0.9, 0.7), seed=2.1)
    rock(bm, S("stone"), (0.085, 0.03, 0), 0.036, scale=(1.0, 0.85, 0.65), rot=(0, 0, D(40)), seed=2.8)
    rock(bm, S("stone"), (-0.07, -0.02, 0), 0.028, scale=(1.0, 0.8, 0.6), rot=(0, 0, D(-25)), seed=3.4)


def build_grass(bm, S):
    grass_blades(bm, S("grass"), (0, 0, 0), scale=1.5, blades=11, seed=4.1)
    grass_blades(bm, S("grass"), (0.05, 0.03, 0), scale=1.0, blades=5, seed=4.6)


def build_fern(bm, S):
    # Seven arched fronds: long thin ellipsoids fanning out, tips raised.
    for i in range(7):
        ang = i * math.tau / 7 + 0.3
        tip = D(24) + (i % 3) * D(5)
        length = 0.135 - (i % 2) * 0.018
        cx, cy = math.cos(ang) * length * 0.45, math.sin(ang) * length * 0.45
        cz = 0.055 + (i % 2) * 0.01
        blob(bm, S("leaf_mid" if i % 2 == 0 else "leaf_deep"), (cx, cy, cz), length * 0.5,
             scale=(2.1, 0.24, 0.3), rot=(0, -tip, ang), bump=0.05, seed=5.0 + i * 0.31,
             segments=9, rings=6)
    grass_blades(bm, S("grass"), (0, 0, 0), scale=0.6, blades=4, seed=6.0)


def build_log(bm, S):
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10,
                                radius1=0.062, radius2=0.07, depth=0.52)
    verts = ret["verts"]
    faces = _new_faces(verts)
    m = Euler((0.0, math.pi / 2, 0.0), "XYZ").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 0.066)) @ m, verts=verts)
    for f in faces:
        f.material_index = S("bark")
        f.smooth = True
    # Moss cap on top
    blob(bm, S("leaf_deep"), (0.05, 0.0, 0.115), 0.055, scale=(1.5, 0.8, 0.35), bump=0.14, seed=7.2, segments=8, rings=6)
    blob(bm, S("leaf_deep"), (-0.16, 0.01, 0.10), 0.04, scale=(1.4, 0.8, 0.35), bump=0.14, seed=7.6, segments=8, rings=6)
    mushroom(bm, S("bark_dark"), S("ember"), (0.19, 0.0, 0.128), height=0.02, cap=0.014, seed=8.1)


def build_stump(bm, S):
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10,
                                radius1=0.095, radius2=0.08, depth=0.12)
    verts = ret["verts"]
    faces = _new_faces(verts)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 0.06)), verts=verts)
    for f in faces:
        f.material_index = S("bark")
        f.smooth = False
    # Ring of growth on the cut face
    ret2 = bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=False, segments=10, radius=0.072)
    v2 = ret2["verts"]
    f2 = _new_faces(v2)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 0.121)), verts=v2)
    for f in f2:
        f.material_index = S("soil")
        f.smooth = False
    blob(bm, S("bark_dark"), (0.06, 0.04, 0.01), 0.035, scale=(1.4, 0.8, 0.5), rot=(0, 0, D(30)), bump=0.14, seed=9.1, segments=8, rings=6)


def build_mushrooms(bm, S):
    mushroom(bm, S("bark_dark"), S("bark"), (0, 0, 0.015), height=0.036, cap=0.024, seed=10.1)
    mushroom(bm, S("bark_dark"), S("bark"), (0.055, 0.02, 0.012), height=0.026, cap=0.017, tilt=0.24, seed=10.6)
    mushroom(bm, S("bark_dark"), S("bark"), (-0.045, 0.035, 0.012), height=0.02, cap=0.013, tilt=-0.2, seed=11.1)
    mushroom(bm, S("bark_dark"), S("bark"), (0.02, -0.05, 0.01), height=0.016, cap=0.011, tilt=0.32, seed=11.5)


def build_flowers(bm, S):
    # Daisy patch: five stems with petal rosettes.
    spots = [(-0.045, 0.02, 0.13, 0.02), (0.02, 0.04, 0.15, 0.017), (0.05, -0.02, 0.12, 0.019),
             (-0.01, -0.045, 0.11, 0.016), (-0.02, 0.06, 0.10, 0.015)]
    for i, (x, y, z, size) in enumerate(spots):
        center = Vector((x, y, z))
        # Stem
        ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=5,
                                    radius1=0.0045, radius2=0.003, depth=z)
        verts = ret["verts"]
        faces = _new_faces(verts)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((x, y, z * 0.5)), verts=verts)
        for f in faces:
            f.material_index = S("grass")
            f.smooth = False
        # Petals around the centre
        for k in range(5):
            ang = k * math.tau / 5 + i * 0.5
            px = x + math.cos(ang) * size * 0.62
            py = y + math.sin(ang) * size * 0.62
            blob(bm, S("petal"), (px, py, z), size * 0.5,
                 scale=(1.0, 0.55, 0.3), rot=(0, 0, ang), bump=0.06, seed=12.0 + i + k * 0.1,
                 segments=8, rings=5)
        blob(bm, S("leaf_bright"), (x, y, z + 0.004), size * 0.34, scale=(1, 1, 0.5),
             bump=0.05, seed=12.7 + i, segments=8, rings=5)
    grass_blades(bm, S("grass"), (0.02, 0.0, 0), scale=0.8, blades=5, seed=13.0)


def build_cairn(bm, S):
    stack = [(0.0, 0.0, 0.048, 0.05), (-0.012, 0.008, 0.132, 0.04),
             (0.01, -0.006, 0.196, 0.031), (-0.004, 0.004, 0.243, 0.023)]
    for i, (x, y, z, r) in enumerate(stack):
        rock(bm, S("stone"), (x, y, z), r, scale=(1.15, 0.95, 0.62), rot=(0, 0, D(i * 47)), seed=14.0 + i)


def build_lantern(bm, S):
    # Post
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=8,
                                radius1=0.016, radius2=0.011, depth=0.34)
    verts = ret["verts"]
    faces = _new_faces(verts)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 0, 0.17)), verts=verts)
    for f in faces:
        f.material_index = S("bark_dark")
        f.smooth = True
    # Head housing (boxy lantern)
    ret2 = bmesh.ops.create_cube(bm, size=1.0)
    v2 = ret2["verts"]
    f2 = _new_faces(v2)
    _place(bm, v2, (0, 0, 0.40), (0.072, 0.072, 0.092), (0, 0, 0))
    for f in f2:
        f.material_index = S("bark_dark")
        f.smooth = False
    # Glow panes — a slightly wider slab poking through the four walls.
    # (The app finds 'DevlofyLeafBright' and boots its emissive while focusing.)
    ret3 = bmesh.ops.create_cube(bm, size=1.0)
    v3 = ret3["verts"]
    f3 = _new_faces(v3)
    _place(bm, v3, (0, 0, 0.40), (0.079, 0.079, 0.052), (0, 0, 0))
    for f in f3:
        f.material_index = S("leaf_bright")
        f.smooth = False
    # Roof (pyramid)
    ret4 = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=4,
                                 radius1=0.075, radius2=0.012, depth=0.045)
    v4 = ret4["verts"]
    f4 = _new_faces(v4)
    m4 = Matrix.Translation((0, 0, 0.468)) @ Euler((0, 0, D(45)), "XYZ").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=m4, verts=v4)
    for f in f4:
        f.material_index = S("bark_dark")
        f.smooth = False


def build_bird(bm, S):
    # Body + head + beak + folded wings + long tail. A small sparrow with
    # ember plumage — reads at garden distance without any animation.
    blob(bm, S("ember"), (0, 0, 0.042), 0.032, scale=(1.4, 1.0, 1.0), rot=(0, 0, D(18)), bump=0.05, seed=16.1, segments=9, rings=7)
    blob(bm, S("ember"), (0.043, -0.004, 0.072), 0.019, scale=(1.0, 1.0, 1.05), bump=0.05, seed=16.4, segments=8, rings=6)
    # Beak
    ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=5,
                                radius1=0.006, radius2=0.0008, depth=0.02)
    verts = ret["verts"]
    faces = _new_faces(verts)
    m = Matrix.Translation((0.066, -0.004, 0.071)) @ Euler((0, math.pi / 2, 0), "XYZ").to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=m, verts=verts)
    for f in faces:
        f.material_index = S("bark_dark")
        f.smooth = False
    # Folded wings hugging the body sides
    for wy in (0.026, -0.026):
        blob(bm, S("ember"), (0.002, wy, 0.048), 0.018, scale=(1.7, 0.5, 0.75),
             rot=(0, 0, D(-8)), bump=0.05, seed=16.7 + wy, segments=8, rings=6)
    # Tail, angled up
    blob(bm, S("ember"), (-0.048, 0.0, 0.052), 0.018, scale=(2.0, 0.5, 0.35),
         rot=(0, D(-18), D(-20)), bump=0.05, seed=17.2, segments=9, rings=6)
    # Legs
    for lx in (0.012, -0.012):
        ret2 = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=True, segments=4,
                                     radius1=0.0035, radius2=0.0025, depth=0.03)
        v2 = ret2["verts"]
        f2 = _new_faces(v2)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((lx, 0.0, 0.015)), verts=v2)
        for f in f2:
            f.material_index = S("bark_dark")
            f.smooth = False


PROPS = {
    "rock": build_rock,
    "rocks": build_rocks,
    "grass": build_grass,
    "fern": build_fern,
    "log": build_log,
    "stump": build_stump,
    "mushrooms": build_mushrooms,
    "flowers": build_flowers,
    "cairn": build_cairn,
    "lantern": build_lantern,
    "bird": build_bird,
}


def main():
    for ob in [o for o in bpy.data.objects if o.name.startswith("prop-")]:
        bpy.data.objects.remove(ob, do_unlink=True)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    summary = []
    for name, build_fn in PROPS.items():
        ob = build_prop(name, build_fn)
        path = EXPORT_DIR / f"prop-{name}.glb"
        export_glb(ob, path)
        me = ob.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        summary.append(f"{name}: {tris} tris, {path.stat().st_size // 1024} KB")
        ob.location = ((len(summary) - 1) * 0.7 - 3.5, -2.6, 0.0)
    bpy.context.view_layer.update()
    print("Devlofy props build complete")
    print("\n".join(summary))


main()
