import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Group } from "three";
import { AVATAR } from "./constants";

type FallbackAvatarProps = {
  position?: [number, number, number];
  rotationY?: number;
};

/**
 * Stand-in avatar rendered while the Ready Player Me GLB is missing from
 * `public/models/avatar.glb`. Keeps the scene alive with idle breath so the
 * room and lighting can be tuned before the real avatar is committed.
 */
export function FallbackAvatar({
  position = [0, 0, 0],
  rotationY = 0,
}: FallbackAvatarProps) {
  const group = useRef<Group>(null);
  const baseY = position[1];

  useFrame(() => {
    const root = group.current;
    if (!root) return;
    const t = performance.now() / 1000;
    root.position.y =
      baseY +
      Math.sin((t * Math.PI * 2) / AVATAR.breathPeriodSeconds) *
        AVATAR.breathAmplitude;
  });

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      {/* Head */}
      <mesh position={[0, 1.48, 0]} castShadow>
        <sphereGeometry args={[0.11, 24, 24]} />
        <meshStandardMaterial color="#d9b89a" roughness={0.6} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.33, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.05, 0.08]} />
        <meshStandardMaterial color="#c8a88a" roughness={0.7} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.42, 0.5, 0.22]} />
        <meshStandardMaterial color="#3c4a5a" roughness={0.9} />
      </mesh>
      {/* Arms (resting on lap) */}
      <mesh position={[-0.22, 0.9, 0.12]} rotation={[0.7, 0, -0.2]} castShadow>
        <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
        <meshStandardMaterial color="#3c4a5a" roughness={0.9} />
      </mesh>
      <mesh position={[0.22, 0.9, 0.12]} rotation={[0.7, 0, 0.2]} castShadow>
        <capsuleGeometry args={[0.05, 0.3, 4, 8]} />
        <meshStandardMaterial color="#3c4a5a" roughness={0.9} />
      </mesh>
      {/* Seated legs */}
      <mesh position={[-0.11, 0.7, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1e2530" roughness={0.9} />
      </mesh>
      <mesh position={[0.11, 0.7, 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.4, 4, 8]} />
        <meshStandardMaterial color="#1e2530" roughness={0.9} />
      </mesh>
    </group>
  );
}
