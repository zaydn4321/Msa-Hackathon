import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { Vector3 } from "three";

export function useXRUserPose() {
  const camera = useThree((s) => s.camera);
  const scratch = useMemo(() => new Vector3(), []);

  return {
    getHeadWorldPosition(target: Vector3 = scratch) {
      return camera.getWorldPosition(target);
    },
  };
}
