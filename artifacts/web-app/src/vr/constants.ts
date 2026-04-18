import type { Vector3Tuple } from "three";

export const SCENE = {
  floorY: 0,
  userSeatPosition: [0, 0, 0] as Vector3Tuple,
  userEyeHeight: 1.2,
  avatarSeatPosition: [0, 0, -2.1] as Vector3Tuple,
  avatarFacing: Math.PI,
  coffeeTablePosition: [0, 0, -1.05] as Vector3Tuple,
};

export const AVATAR = {
  breathAmplitude: 0.012,
  breathPeriodSeconds: 3.2,
  blinkIntervalMinMs: 3000,
  blinkIntervalMaxMs: 6500,
  blinkDurationMs: 140,
  headLookMaxYaw: 0.35,
  headLookMaxPitch: 0.22,
  headLookDeadZone: 0.02,
  headLookLerp: 0.08,
  eyeLookLerp: 0.18,
};

export const LIGHTING = {
  keyLightIntensity: 1.1,
  keyLightColor: "#ffd8a8",
  keyLightPosition: [3.5, 2.8, 1.8] as Vector3Tuple,
  ambientIntensity: 0.35,
  ambientColor: "#b6c4d8",
  envIntensity: 0.9,
};

export const ASSETS = {
  avatarUrl: "/models/avatar.glb",
  roomUrl: "/models/therapy-room.glb",
  hdriUrl: "/hdri/dusk-interior.hdr",
};
