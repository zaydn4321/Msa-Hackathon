import { Environment } from "@react-three/drei";
import { Suspense, useRef } from "react";
import { SafeAvatar } from "./SafeAvatar";
import { type AvatarSpeakHandle } from "./Avatar";
import { FallbackRoom } from "./FallbackRoom";
import { SCENE, LIGHTING } from "./constants";

export function Scene() {
  const avatarRef = useRef<AvatarSpeakHandle>(null);

  return (
    <>
      <color attach="background" args={["#0b0f18"]} />
      <fog attach="fog" args={["#0b0f18", 6, 14]} />

      <ambientLight
        intensity={LIGHTING.ambientIntensity}
        color={LIGHTING.ambientColor}
      />
      <directionalLight
        castShadow
        intensity={LIGHTING.keyLightIntensity}
        color={LIGHTING.keyLightColor}
        position={LIGHTING.keyLightPosition}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />

      <Suspense fallback={null}>
        <Environment
          preset="apartment"
          environmentIntensity={LIGHTING.envIntensity}
        />
      </Suspense>

      <Suspense fallback={<FallbackRoom />}>
        {/* Swap FallbackRoom with <TherapyRoom /> once the GLB asset lands in
            public/models/therapy-room.glb. Keeping fallback active by default
            so the scene renders without art dependencies. */}
        <FallbackRoom />
      </Suspense>

      <SafeAvatar
        ref={avatarRef}
        position={SCENE.avatarSeatPosition}
        rotationY={SCENE.avatarFacing}
      />
    </>
  );
}
