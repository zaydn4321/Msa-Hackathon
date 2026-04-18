import { Component, ReactNode, Suspense, forwardRef, useEffect, useState } from "react";
import { Avatar, type AvatarSpeakHandle } from "./Avatar";
import { FallbackAvatar } from "./FallbackAvatar";
import { ASSETS } from "./constants";

type Props = {
  position?: [number, number, number];
  rotationY?: number;
};

type BoundaryProps = { fallback: ReactNode; children: ReactNode };
type BoundaryState = { failed: boolean };

class AvatarBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[vr] avatar asset missing or failed to load", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function useAssetExists(url: string) {
  const [state, setState] = useState<"checking" | "present" | "absent">(
    "checking",
  );
  useEffect(() => {
    let cancelled = false;
    fetch(url, { method: "HEAD" })
      .then((res) => {
        if (cancelled) return;
        const contentType = res.headers.get("content-type") ?? "";
        // Vite's dev SPA fallback returns index.html (text/html) for missing
        // static files with HTTP 200 — treat that as absent too.
        setState(
          res.ok && !contentType.includes("text/html") ? "present" : "absent",
        );
      })
      .catch(() => {
        if (!cancelled) setState("absent");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return state;
}

export const SafeAvatar = forwardRef<AvatarSpeakHandle, Props>(function SafeAvatar(
  { position, rotationY },
  ref,
) {
  const asset = useAssetExists(ASSETS.avatarUrl);

  if (asset !== "present") {
    return <FallbackAvatar position={position} rotationY={rotationY} />;
  }

  return (
    <AvatarBoundary fallback={<FallbackAvatar position={position} rotationY={rotationY} />}>
      <Suspense fallback={<FallbackAvatar position={position} rotationY={rotationY} />}>
        <Avatar ref={ref} position={position} rotationY={rotationY} />
      </Suspense>
    </AvatarBoundary>
  );
});
