import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Mesh } from "three";
import { ASSETS } from "./constants";

type TherapyRoomProps = {
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
};

export function TherapyRoom({
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: TherapyRoomProps) {
  const gltf = useGLTF(ASSETS.roomUrl);

  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  useEffect(() => {
    cloned.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = false;
        mesh.receiveShadow = true;
      }
    });
  }, [cloned]);

  return (
    <primitive
      object={cloned}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    />
  );
}

