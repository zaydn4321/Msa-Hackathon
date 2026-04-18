import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { XR, createXRStore, XROrigin } from "@react-three/xr";
import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { Scene } from "@/vr/Scene";
import { SCENE } from "@/vr/constants";

const xrStore = createXRStore();

type MaybeXR = {
  isSessionSupported: (mode: string) => Promise<boolean>;
};

export default function VrPage() {
  const [, withSession] = useRoute<{ sessionId: string }>("/vr/:sessionId");
  const sessionId = withSession?.sessionId;

  const [vrSupported, setVrSupported] = useState<boolean | null>(null);
  const [inXR, setInXR] = useState(false);

  useEffect(() => {
    const xr = (navigator as Navigator & { xr?: MaybeXR }).xr;
    if (!xr) {
      setVrSupported(false);
      return;
    }
    xr.isSessionSupported("immersive-vr")
      .then(setVrSupported)
      .catch(() => setVrSupported(false));
    const unsub = xrStore.subscribe((state: { session?: unknown }) => {
      setInXR(state.session !== undefined);
    });
    return () => unsub();
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050d1a] text-white">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, SCENE.userEyeHeight, 0.1], fov: 70, near: 0.05, far: 50 }}
      >
        <XR store={xrStore}>
          <XROrigin position={SCENE.userSeatPosition} />
          <Scene />
          {!inXR ? (
            <OrbitControls
              target={[0, SCENE.userEyeHeight - 0.1, -2.1]}
              enablePan={false}
              maxDistance={4}
              minDistance={0.5}
              maxPolarAngle={Math.PI / 1.8}
            />
          ) : null}
        </XR>
      </Canvas>

      {!inXR ? (
        <Overlay
          vrSupported={vrSupported}
          sessionId={sessionId}
          onEnter={() => xrStore.enterVR()}
        />
      ) : null}
    </div>
  );
}

type OverlayProps = {
  vrSupported: boolean | null;
  sessionId: string | undefined;
  onEnter: () => void;
};

function Overlay({ vrSupported, sessionId, onEnter }: OverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-between p-6">
      <div className="pointer-events-auto self-start rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 backdrop-blur">
        Anamnesis VR · Therapy Room
        {sessionId ? <span className="ml-2 text-white/40">#{sessionId}</span> : null}
      </div>

      <div className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/50 px-8 py-6 text-center backdrop-blur">
        <p className="text-sm text-white/70">
          {vrSupported === null
            ? "Checking for a VR headset\u2026"
            : vrSupported
              ? "Put on your Meta Quest Pro and tap Enter VR."
              : "No VR headset detected \u2014 you can still preview the room on this screen."}
        </p>
        <button
          type="button"
          onClick={onEnter}
          disabled={!vrSupported}
          className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#050d1a] transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Enter VR
        </button>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30">
          Drag to look around in the preview
        </p>
      </div>
    </div>
  );
}
