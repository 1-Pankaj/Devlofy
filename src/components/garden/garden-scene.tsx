/**
 * Focus Garden scene — the app's 3D centerpiece.
 *
 * One implementation, two runtimes: `@/lib/three` resolves to the expo-gl
 * renderer on native and the DOM renderer on web. The tree is generated from
 * `src/lib/garden/model.ts`; a Blender-authored GLB can later be layered in
 * (see docs/05-blender-pipeline.md) without touching this component's API.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { Group, InstancedMesh } from 'three';

import { makeTree, type Branch } from '@/lib/garden/model';
import { Canvas, THREE, useFrame } from '@/lib/three';

const TRUNK_COLOR = '#6E5B4C';
const GROUND_COLOR = '#0B100D';
const RING_COLOR = '#3EE08F';

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

function Tree({ seed, growth }: { seed: number; growth: number }) {
  const sway = useRef<Group>(null);
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

  return (
    <group ref={sway}>
      {segments.map((segment, index) => (
        <mesh
          key={index}
          position={segment.position}
          quaternion={segment.quaternion as unknown as THREE.Quaternion}
          castShadow={false}>
          <cylinderGeometry args={[segment.radius * 0.72, segment.radius, segment.length, 6]} />
          <meshStandardMaterial color={TRUNK_COLOR} roughness={0.9} flatShading />
        </mesh>
      ))}
      <instancedMesh
        ref={leafMesh}
        args={[undefined, undefined, tree.leaves.length]}
        frustumCulled={false}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#3EE08F" roughness={0.75} flatShading />
      </instancedMesh>
    </group>
  );
}

function Ground() {
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
        <meshBasicMaterial color={RING_COLOR} transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[2.05, 2.08, 64]} />
        <meshBasicMaterial color={RING_COLOR} transparent opacity={0.1} />
      </mesh>
      {/* Soft contact shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <circleGeometry args={[0.9, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.32} />
      </mesh>
    </group>
  );
}

export type GardenSceneProps = {
  /** Deterministic structure seed (session volume or a stable app seed). */
  seed?: number;
  /** 0 → seedling, 1 → fully grown. */
  growth?: number;
  /** False for teasers: renders on demand instead of a continuous loop. */
  animated?: boolean;
  style?: ViewStyle;
};

export function GardenScene({ seed = 7, growth = 0.5, animated = true, style }: GardenSceneProps) {
  return (
    <View style={[styles.frame, style]}>
      <Canvas
        style={styles.canvas}
        dpr={[1, 1.75]}
        frameloop={animated ? 'always' : 'demand'}
        camera={{ position: [3.5, 2.4, 4.6], fov: 38 }}
        gl={{ antialias: true, alpha: true }}>
        <ambientLight intensity={0.5} color="#CFE9DA" />
        <directionalLight position={[5, 7, 4]} intensity={1.25} color="#FFF3DF" />
        <directionalLight position={[-4, 2.5, -3]} intensity={0.35} color="#7CC4FF" />
        <Ground />
        <Tree seed={seed} growth={growth} />
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
});
