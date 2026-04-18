import { ContactShadows } from "@react-three/drei";

/**
 * Procedural fallback scene used until the real `therapy-room.glb`
 * asset is committed to `artifacts/web-app/public/models/therapy-room.glb`.
 * Keeps the route renderable end-to-end without blocking on art.
 */
export function FallbackRoom() {
  return (
    <group>
      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#3a2a20" roughness={0.9} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 1.6, -4]}>
        <planeGeometry args={[12, 3.2]} />
        <meshStandardMaterial color="#2a2e3a" roughness={0.95} />
      </mesh>

      {/* Left wall with a warm window */}
      <mesh position={[-4, 1.6, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#2f3340" roughness={0.95} />
      </mesh>
      <mesh position={[-3.98, 1.6, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[3.6, 2.0]} />
        <meshStandardMaterial
          color="#ffd59a"
          emissive="#ffb56b"
          emissiveIntensity={0.9}
          roughness={1}
        />
      </mesh>

      {/* Right wall */}
      <mesh position={[4, 1.6, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[8, 3.2]} />
        <meshStandardMaterial color="#2f3340" roughness={0.95} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation-x={Math.PI / 2} position={[0, 3.2, 0]}>
        <planeGeometry args={[12, 12]} />
        <meshStandardMaterial color="#2a2e3a" roughness={1} />
      </mesh>

      {/* Rug */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, -1]}>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#6b4a3a" roughness={1} />
      </mesh>

      {/* Coffee table */}
      <group position={[0, 0.35, -1.05]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.05, 0.55]} />
          <meshStandardMaterial color="#4a3020" roughness={0.6} />
        </mesh>
        {[
          [-0.5, -0.2, -0.22],
          [0.5, -0.2, -0.22],
          [-0.5, -0.2, 0.22],
          [0.5, -0.2, 0.22],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <cylinderGeometry args={[0.025, 0.025, 0.4]} />
            <meshStandardMaterial color="#2e1f15" roughness={0.7} />
          </mesh>
        ))}
      </group>

      {/* Therapist couch (behind the avatar) */}
      <group position={[0, 0, -2.4]}>
        {/* Seat */}
        <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.35, 0.75]} />
          <meshStandardMaterial color="#6d8a9c" roughness={0.9} />
        </mesh>
        {/* Back */}
        <mesh position={[0, 0.9, -0.35]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.75, 0.15]} />
          <meshStandardMaterial color="#6d8a9c" roughness={0.9} />
        </mesh>
        {/* Arms */}
        <mesh position={[-1.0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.15, 0.55, 0.75]} />
          <meshStandardMaterial color="#5a7688" roughness={0.9} />
        </mesh>
        <mesh position={[1.0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.15, 0.55, 0.75]} />
          <meshStandardMaterial color="#5a7688" roughness={0.9} />
        </mesh>
      </group>

      {/* Potted plant in the corner */}
      <group position={[2.8, 0, -3.2]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.22, 0.18, 0.4]} />
          <meshStandardMaterial color="#8b6a4a" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <sphereGeometry args={[0.5, 20, 20]} />
          <meshStandardMaterial color="#3f5a3a" roughness={1} />
        </mesh>
      </group>

      {/* Floor lamp */}
      <group position={[-2.6, 0, -2.8]}>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 1.8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
        </mesh>
        <mesh position={[0, 1.85, 0]} castShadow>
          <coneGeometry args={[0.22, 0.28, 20, 1, true]} />
          <meshStandardMaterial
            color="#f7e3b6"
            emissive="#f7c478"
            emissiveIntensity={0.6}
            roughness={0.9}
            side={2}
          />
        </mesh>
        <pointLight
          position={[0, 1.85, 0]}
          intensity={0.8}
          color="#ffcf8c"
          distance={3.5}
          decay={2}
        />
      </group>

      <ContactShadows
        position={[0, 0.002, -1]}
        opacity={0.55}
        blur={2.4}
        scale={8}
        far={3}
      />
    </group>
  );
}
