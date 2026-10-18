/**
 * Focus Garden scene — the app's 3D centerpiece.
 *
 * One implementation, two runtimes: `@/lib/three` resolves to the expo-gl
 * renderer on native and the DOM renderer on web. The tree prefers the
 * Blender-authored GLB for its growth stage (`lib/garden/models.ts`) and falls
 * back to the procedural generator in `lib/garden/model.ts` until it loads —
 * or forever, if loading fails.
 */
import { Plant } from 'phosphor-react-native';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { Group, InstancedMesh, Mesh } from 'three';

import { AppText } from '@/components/ui/app-text';
import { makeTree, type Branch, type GrowthInput } from '@/lib/garden/model';
import { loadVariant, variantForGrowth, type GardenVariant } from '@/lib/garden/models';
import {
  dressingFor,
  isKitOnly,
  kitFor,
  loadProp,
  trophiesFor,
  type PropPlacement,
} from '@/lib/garden/props';
import { Canvas, THREE, useFrame, useThree } from '@/lib/three';
import { GLOW_MATERIAL } from '@/lib/three/kit';
import { hasWebGL } from '@/lib/three/webgl';
import { radius, spacing, useTheme } from '@/theme';

/** Bark and soil, matched to the authored `DevlofyBark`/`DevlofySoil` materials. */
const TRUNK_COLOR = '#3A2A1F';
const GROUND_COLOR = '#080603';
/** Leaves of the procedural tree, matched to `DevlofyLeafBright`. */
const LEAF_COLOR = '#0CBE46';

type CylinderTransform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  length: number;
  radius: number;
};

function toCylinder(branch: Branch): CylinderTransform {
  const start = new THREE.Vector3(...branch.start);
  const end = new THREE.Vector3(...branch.end);
  const dir = end.clone().sub(start);
  const length = dir.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize(),
  );
  const mid = start.clone().add(end).multiplyScalar(0.5);
  return {
    position: [mid.x, mid.y, mid.z],
    quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
    length,
    radius: branch.radius,
  };
}

/**
 * The Blender model for the current stage, cloned per consumer. `null` keeps
 * the procedural tree on screen — also the failure path, so there is never a
 * blank frame.
 */
function useGardenModel(variant: GardenVariant): Group | null {
  const [model, setModel] = useState<Group | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadVariant(variant)
      .then((scene) => {
        if (cancelled) return;
        const clone = scene.clone(true);
        // Let every part of the model cast and receive the key light's shadow.
        clone.traverse((object) => {
          if ((object as Mesh).isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        setModel(clone);
      })
      .catch(() => {
        // Procedural fallback remains.
      });
    return () => {
      cancelled = true;
    };
  }, [variant]);

  return model;
}

/** Aims the camera at the tree's centre of mass — R3F's default aims at y=0,
 *  which buries the small stages in the lower half of the frame. */
function CameraAim({ y }: { y: number }) {
  const camera = useThree((state) => state.camera);
  useEffect(() => {
    camera.lookAt(0, y, 0);
  }, [camera, y]);
  return null;
}

function Tree({ seed, growth }: { seed: number; growth: number }) {
  const sway = useRef<Group>(null);
  const model = useGardenModel(variantForGrowth(growth));
  const tree = useMemo(() => makeTree(seed, growth), [seed, growth]);
  const segments = useMemo(() => tree.branches.map(toCylinder), [tree]);
  const leafMesh = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = leafMesh.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    tree.leaves.forEach((leaf, index) => {
      scale.setScalar(leaf.scale);
      matrix.compose(new THREE.Vector3(...leaf.position), quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.count = tree.leaves.length;
    mesh.instanceMatrix.needsUpdate = true;
  }, [tree]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (sway.current) {
      sway.current.rotation.z = Math.sin(t * 0.55) * 0.014;
      sway.current.rotation.y = Math.sin(t * 0.13) * 0.05 + t * 0.012;
    }
  });

  if (model) {
    return (
      <group ref={sway}>
        <primitive object={model} />
      </group>
    );
  }

  return (
    <group ref={sway}>
      {segments.map((segment, index) => (
        <mesh
          key={index}
          position={segment.position}
          quaternion={segment.quaternion as unknown as THREE.Quaternion}
          castShadow>
          <cylinderGeometry args={[segment.radius * 0.72, segment.radius, segment.length, 6]} />
          <meshStandardMaterial color={TRUNK_COLOR} roughness={0.9} flatShading />
        </mesh>
      ))}
      <instancedMesh
        ref={leafMesh}
        args={[undefined, undefined, tree.leaves.length]}
        frustumCulled={false}
        castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={LEAF_COLOR} roughness={0.75} flatShading />
      </instancedMesh>
    </group>
  );
}

/**
 * One prop placement, answered three ways:
 *
 *  - the two **kit-only** props (`bench`, `signpost`) are built in code and are
 *    on screen from the first frame — no GLB exists to wait for;
 *  - everything else prefers its **authored GLB**, cloned per consumer;
 *  - if that GLB never arrives, the prop is built **from the kit** instead of
 *    leaving a hole in the garden.
 *
 * The lantern's glass — authored or code-built — burns brighter mid-session.
 */
function Prop({ placement, focusing }: { placement: PropPlacement; focusing: boolean }) {
  const kitOnly = isKitOnly(placement.prop);
  const [model, setModel] = useState<Group | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const prop = placement.prop;
    if (isKitOnly(prop)) return;
    let cancelled = false;
    loadProp(prop)
      .then((scene) => {
        if (cancelled) return;
        const clone = scene.clone(true);
        clone.traverse((object) => {
          if ((object as Mesh).isMesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        setModel(clone);
      })
      .catch(() => {
        // The kit answers instead — see `object` below.
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [placement.prop]);

  const object = useMemo(() => {
    if (model) return model;
    if (!kitOnly && !failed) return null;
    return kitFor(placement);
  }, [failed, kitOnly, model, placement]);

  // The lantern answers focus: dim glass at rest, live glow mid-session.
  useEffect(() => {
    if (!object || placement.prop !== 'lantern') return;
    object.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const glows = material.name === 'DevlofyLeafBright' || material.name === GLOW_MATERIAL;
        if (glows && 'emissiveIntensity' in material) {
          (material as THREE.MeshStandardMaterial).emissiveIntensity = focusing ? 2.6 : 0.5;
        }
      });
    });
  }, [focusing, object, placement.prop]);

  if (!object) return null;

  return (
    <primitive
      object={object}
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
      scale={placement.scale}
    />
  );
}

/** Soil, growth rings and a contact shadow. The rings carry the brand colour,
 *  which is the one place the interface and the 3D scene share an accent. */
function Ground({ ringColor }: { ringColor: string }) {
  return (
    <group>
      {/* Soil disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[2.7, 48]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={1} />
      </mesh>
      {/* Growth rings — quiet accent detail */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[1.35, 1.4, 64]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[2.05, 2.08, 64]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.16} />
      </mesh>
      {/* Soft contact shadow (ambient-occlusion helper under the real shadow) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

/**
 * The still that stands in when the platform cannot give us a GPU context.
 * Quiet on purpose: a soft well and the sprout, no apology copy.
 */
function GardenPreview({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.frame,
        styles.preview,
        { backgroundColor: colors.surfaceElevated },
        style,
      ]}>
      <View style={[styles.previewRing, { borderColor: colors.accentBorder }]}>
        <View style={[styles.previewWell, { backgroundColor: colors.accentSoft }]}>
          <Plant size={40} color={colors.accent} weight="fill" />
        </View>
      </View>
      <AppText variant="caption" tone="tertiary">
        3D is unavailable in this browser.
      </AppText>
    </View>
  );
}

export type GardenSceneProps = {
  /** Deterministic structure seed (session volume or a stable app seed). */
  seed?: number;
  /** 0 → seedling, 1 → fully grown. */
  growth?: number;
  /** Focus history — drives dressing tiers and the earned trophies. */
  stats?: GrowthInput;
  /** Active projects — the signpost hangs one plate per project. */
  projects?: number;
  /** A session is running; the lantern burns brighter. */
  focusing?: boolean;
  /** False for teasers: renders on demand instead of a continuous loop. */
  animated?: boolean;
  style?: ViewStyle;
};

export function GardenScene({
  seed = 7,
  growth = 0.5,
  stats,
  projects = 0,
  focusing = false,
  animated = true,
  style,
}: GardenSceneProps) {
  const { colors } = useTheme();
  const [webgl] = useState(hasWebGL);
  const totalMinutes = stats?.totalMinutes ?? 0;
  const streakDays = stats?.streakDays ?? 0;
  const todayMinutes = stats?.todayMinutes ?? 0;
  const hasStats = stats !== undefined;
  const placements = useMemo(
    () =>
      hasStats
        ? [
            ...dressingFor(growth, projects),
            ...trophiesFor({ totalMinutes, streakDays, todayMinutes }),
          ]
        : [],
    [hasStats, growth, projects, totalMinutes, streakDays, todayMinutes],
  );
  // No GPU context — a locked-down browser, WebGL switched off, a headless
  // render. Show a still instead of letting the renderer throw and take the
  // whole app down with it.
  if (!webgl) return <GardenPreview style={style} />;

  return (
    <View style={[styles.frame, style]}>
      <Canvas
        shadows
        style={styles.canvas}
        dpr={[1, 1.75]}
        frameloop={animated ? 'always' : 'demand'}
        camera={{ position: [3.5, 2.4, 4.6], fov: 38 }}
        gl={{ antialias: true, alpha: true }}>
        <CameraAim y={0.35 + 0.72 * growth} />
        <ambientLight intensity={0.45} color="#EFE3D6" />
        <directionalLight
          position={[5, 7, 4]}
          intensity={1.35}
          color="#FFF3DF"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-3.2}
          shadow-camera-right={3.2}
          shadow-camera-top={3.6}
          shadow-camera-bottom={-1.4}
          shadow-camera-near={1}
          shadow-camera-far={24}
          shadow-bias={-0.0004}
          shadow-normalBias={0.03}
        />
        <directionalLight position={[-4, 2.5, -3]} intensity={0.4} color="#7CC4FF" />
        <Ground ringColor={colors.accent} />
        <Tree seed={seed} growth={growth} />
        {placements.map((item) => (
          <Prop key={`${item.prop}-${item.slot}`} placement={item} focusing={focusing} />
        ))}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
  },
  preview: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  previewWell: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewRing: {
    width: 156,
    height: 156,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
