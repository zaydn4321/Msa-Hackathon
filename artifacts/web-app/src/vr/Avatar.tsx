import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  Bone,
  Euler,
  Group,
  MathUtils,
  Mesh,
  Object3D,
  SkinnedMesh,
  Vector3,
} from "three";
import { AVATAR, ASSETS } from "./constants";
import { useXRUserPose } from "./useXRUserPose";

export type AvatarSpeakHandle = {
  speak: (audio: AudioBuffer, visemes?: VisemeFrame[]) => void;
  stopSpeaking: () => void;
};

export type VisemeFrame = {
  timeMs: number;
  viseme: string;
  weight: number;
};

type AvatarProps = {
  position?: [number, number, number];
  rotationY?: number;
};

const BLINK_MORPHS = ["eyeBlinkLeft", "eyeBlinkRight"];
const HEAD_BONE_NAMES = ["Head", "mixamorigHead", "head"];
const LEFT_EYE_BONE_NAMES = ["LeftEye", "mixamorigLeftEye", "leftEye"];
const RIGHT_EYE_BONE_NAMES = ["RightEye", "mixamorigRightEye", "rightEye"];

function findBone(root: Object3D, names: string[]): Bone | null {
  for (const name of names) {
    const found = root.getObjectByName(name);
    if (found && (found as Bone).isBone) return found as Bone;
  }
  return null;
}

function collectMorphMeshes(root: Object3D): SkinnedMesh[] {
  const meshes: SkinnedMesh[] = [];
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (
      (mesh as SkinnedMesh).isSkinnedMesh &&
      mesh.morphTargetDictionary &&
      mesh.morphTargetInfluences
    ) {
      meshes.push(mesh as SkinnedMesh);
    }
  });
  return meshes;
}

export const Avatar = forwardRef<AvatarSpeakHandle, AvatarProps>(function Avatar(
  { position = [0, 0, 0], rotationY = 0 },
  ref,
) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(ASSETS.avatarUrl);
  const baseY = position[1];

  const morphMeshes = useMemo(() => collectMorphMeshes(gltf.scene), [gltf.scene]);
  const headBone = useMemo(() => findBone(gltf.scene, HEAD_BONE_NAMES), [gltf.scene]);
  const leftEyeBone = useMemo(
    () => findBone(gltf.scene, LEFT_EYE_BONE_NAMES),
    [gltf.scene],
  );
  const rightEyeBone = useMemo(
    () => findBone(gltf.scene, RIGHT_EYE_BONE_NAMES),
    [gltf.scene],
  );
  const headRestRotation = useMemo(
    () => (headBone ? headBone.rotation.clone() : new Euler()),
    [headBone],
  );

  const blinkState = useRef<{ nextBlinkAt: number; blinkEndsAt: number }>({
    nextBlinkAt: performance.now() + randomBlinkDelay(),
    blinkEndsAt: 0,
  });

  const pose = useXRUserPose();
  const userWorld = useRef(new Vector3());
  const userLocal = useRef(new Vector3());
  const boneLocal = useRef(new Vector3());
  const dirLocal = useRef(new Vector3());

  useEffect(() => {
    gltf.scene.traverse((child) => {
      const mesh = child as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });
  }, [gltf.scene]);

  useImperativeHandle(
    ref,
    () => ({
      speak: (_audio, _visemes) => {
        // Voice-pipeline seam. When the conversation layer lands, it will:
        // 1. Attach a PositionalAudio node to `headBone` with `_audio`.
        // 2. Each frame, look up the active viseme in `_visemes` by `timeMs`
        //    and set matching morph targets ("viseme_aa", "viseme_O", ...).
        // No-op for now so the environment can be iterated on in isolation.
      },
      stopSpeaking: () => {
        // Matches the seam above; nothing to stop yet.
      },
    }),
    [],
  );

  useFrame(() => {
    const root = group.current;
    if (!root) return;

    const t = performance.now() / 1000;
    const breath =
      Math.sin((t * Math.PI * 2) / AVATAR.breathPeriodSeconds) *
      AVATAR.breathAmplitude;
    root.position.y = baseY + breath;

    const blink = blinkState.current;
    const now = performance.now();
    if (now >= blink.nextBlinkAt && blink.blinkEndsAt === 0) {
      blink.blinkEndsAt = now + AVATAR.blinkDurationMs;
    }
    const blinkWeight =
      blink.blinkEndsAt > 0
        ? triangleWindow(
            now,
            blink.blinkEndsAt - AVATAR.blinkDurationMs,
            blink.blinkEndsAt,
          )
        : 0;
    if (blink.blinkEndsAt > 0 && now >= blink.blinkEndsAt) {
      blink.blinkEndsAt = 0;
      blink.nextBlinkAt = now + randomBlinkDelay();
    }
    applyMorph(morphMeshes, BLINK_MORPHS, blinkWeight);

    if (headBone) {
      pose.getHeadWorldPosition(userWorld.current);
      userLocal.current.copy(userWorld.current);
      root.worldToLocal(userLocal.current);

      boneLocal.current.setFromMatrixPosition(headBone.matrixWorld);
      root.worldToLocal(boneLocal.current);

      dirLocal.current.copy(userLocal.current).sub(boneLocal.current);
      if (dirLocal.current.lengthSq() < 1e-6) {
        dirLocal.current.set(0, 0, 1);
      } else {
        dirLocal.current.normalize();
      }

      // Avatar is rotated 180° (facing +Z via rotationY=π); in its local frame
      // the user sits in the +Z direction. atan2(x, z) gives yaw around Y.
      let yaw = Math.atan2(dirLocal.current.x, dirLocal.current.z);
      let pitch = Math.asin(
        MathUtils.clamp(dirLocal.current.y, -1, 1),
      );
      yaw = MathUtils.clamp(yaw, -AVATAR.headLookMaxYaw, AVATAR.headLookMaxYaw);
      pitch = MathUtils.clamp(
        pitch,
        -AVATAR.headLookMaxPitch,
        AVATAR.headLookMaxPitch,
      );
      if (Math.abs(yaw) < AVATAR.headLookDeadZone) yaw = 0;
      if (Math.abs(pitch) < AVATAR.headLookDeadZone) pitch = 0;

      headBone.rotation.x = MathUtils.lerp(
        headBone.rotation.x,
        headRestRotation.x + pitch,
        AVATAR.headLookLerp,
      );
      headBone.rotation.y = MathUtils.lerp(
        headBone.rotation.y,
        headRestRotation.y + yaw,
        AVATAR.headLookLerp,
      );

      [leftEyeBone, rightEyeBone].forEach((eye) => {
        if (!eye) return;
        eye.rotation.x = MathUtils.lerp(
          eye.rotation.x,
          pitch * 1.3,
          AVATAR.eyeLookLerp,
        );
        eye.rotation.y = MathUtils.lerp(
          eye.rotation.y,
          yaw * 1.3,
          AVATAR.eyeLookLerp,
        );
      });
    }
  });

  return (
    <group ref={group} position={position} rotation={[0, rotationY, 0]}>
      <primitive object={gltf.scene} />
    </group>
  );
});

function randomBlinkDelay() {
  return (
    AVATAR.blinkIntervalMinMs +
    Math.random() * (AVATAR.blinkIntervalMaxMs - AVATAR.blinkIntervalMinMs)
  );
}

function triangleWindow(now: number, start: number, end: number) {
  const mid = (start + end) / 2;
  if (now <= start || now >= end) return 0;
  return now < mid
    ? (now - start) / (mid - start)
    : 1 - (now - mid) / (end - mid);
}

function applyMorph(meshes: SkinnedMesh[], names: string[], weight: number) {
  meshes.forEach((mesh) => {
    const dict = mesh.morphTargetDictionary;
    const influences = mesh.morphTargetInfluences;
    if (!dict || !influences) return;
    names.forEach((name) => {
      const idx = dict[name];
      if (typeof idx === "number") influences[idx] = weight;
    });
  });
}

