"""Devlofy empty-state stills — small EEVEE renders of the prop models.

Run inside the live Blender session (MCP `execute_blender_code`):

    exec(compile(open(r"tools/blender/empty_state_stills.py", encoding="utf-8").read(), "empty_state_stills.py", "exec"))

Renders transparent-background PNGs into `assets/images/empty/` — one per
empty state (notes / clients / projects / tasks / focus). Re-runnable: the
scene is restored to its pre-render state afterwards.
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "assets" / "images" / "empty"

STILLS = {
    "notes": ["prop-flowers"],
    "clients": ["prop-cairn"],
    "projects": ["prop-stump", "prop-mushrooms"],
    "tasks": ["prop-grass", "prop-rocks"],
    "focus": ["prop-lantern"],
}

SECONDARY_OFFSET = (0.16, 0.05)


def aim(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def clean_previous():
    for name in ("still-camera", "still-key", "still-fill", "still-rim", "still-ground"):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)


def create_ground():
    mesh = bpy.data.meshes.new("still-ground")
    import bmesh

    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, cap_tris=False, segments=48, radius=1.0)
    bm.to_mesh(mesh)
    bm.free()
    soil = bpy.data.materials.get("DevlofySoil")
    if soil:
        mesh.materials.append(soil)
    obj = bpy.data.objects.new("still-ground", mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def create_lights():
    def light(name, kind, loc, energy, color, size=0.8):
        data = bpy.data.lights.new(name, type=kind)
        data.energy = energy
        data.color = color
        if kind == "AREA":
            data.size = size
        obj = bpy.data.objects.new(name, data)
        obj.location = loc
        bpy.context.scene.collection.objects.link(obj)
        aim(obj, (0.0, 0.0, 0.08))
        return obj

    light("still-key", "AREA", (0.8, -0.7, 1.0), 60, (1.0, 0.95, 0.87), 0.9)
    light("still-fill", "AREA", (-0.9, -0.45, 0.45), 16, (0.6, 0.75, 1.0), 1.3)
    light("still-rim", "AREA", (0.1, 0.9, 0.75), 55, (0.55, 1.0, 0.75), 0.6)


def bounds_of(objects):
    lo = Vector((math.inf, math.inf, math.inf))
    hi = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objects:
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            lo = Vector((min(lo[i], point[i]) for i in range(3)))
            hi = Vector((max(hi[i], point[i]) for i in range(3)))
    return lo, hi


def main():
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 512
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    try:
        scene.view_settings.view_transform = "Standard"
    except Exception:
        pass
    try:
        scene.eevee.use_bloom = True
        scene.eevee.bloom_intensity = 0.04
        scene.eevee.bloom_threshold = 0.95
    except Exception:
        pass

    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
    if bg:
        bg.inputs[0].default_value = (0.012, 0.02, 0.016, 1.0)
        bg.inputs[1].default_value = 0.35

    clean_previous()
    create_lights()
    ground = create_ground()

    cam_data = bpy.data.cameras.new("still-camera")
    cam_data.lens = 55
    cam = bpy.data.objects.new("still-camera", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    scene.camera = cam

    # Remember object state so the scene survives the render pass. Every mesh
    # in the scene (props, trees, the default cube) is managed: anything that
    # is not part of the current still gets hidden, so no rogue backdrop is
    # baked into the generous alpha.
    managed = {
        o.name: o
        for o in bpy.data.objects
        if o.type == "MESH" and not o.name.startswith("still-")
    }
    original = {name: (tuple(o.location), o.hide_render) for name, o in managed.items()}

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    summary = []
    for still, names in STILLS.items():
        targets = [managed[name] for name in names if name in managed]
        for name, obj in managed.items():
            obj.hide_render = name not in names
            if name in names:
                obj.location = (0.0, 0.0, 0.0)
        # Offset the secondary object so pairs read as a small scene.
        for index, obj in enumerate(targets[1:], start=1):
            obj.location = (SECONDARY_OFFSET[0] * index, SECONDARY_OFFSET[1] * index, 0.0)
            obj.rotation_euler = (0.0, 0.0, math.radians(35 * index))

        # Bounds read matrix_world, which is only fresh after a depsgraph sync.
        bpy.context.view_layer.update()
        lo, hi = bounds_of(targets)
        size = max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)
        target_z = min(0.16, (hi.z - lo.z) * 0.42)
        direction = Vector((0.62, -0.85, 0.40)).normalized()
        distance = max(0.72, size * 2.4)
        cam.location = Vector((0.0, 0.0, target_z)) + direction * distance
        aim(cam, (0.0, 0.0, target_z))
        ground.scale = (max(size * 1.6, 0.24),) * 3

        scene.render.filepath = str(OUT_DIR / f"{still}.png")
        bpy.ops.render.render(write_still=True)
        summary.append(f"{still}: {names} -> {still}.png ({size:.2f} m)")

    # Restore.
    for name, (location, hidden) in original.items():
        if name in managed:
            managed[name].location = location
            managed[name].hide_render = hidden
    ground.hide_render = True
    print("Devlofy empty-state stills complete")
    print("\n".join(summary))


main()
