# HDRI environment maps

The VR scene currently uses drei's built-in `"apartment"` environment preset,
so you don't need to drop a file here to get up and running.

If you want a warmer, more specific look, grab an HDRI from **Poly Haven**
(https://polyhaven.com/hdris — CC0) and save it as `dusk-interior.hdr` here,
then swap the `<Environment preset="apartment" />` line in
`src/vr/Scene.tsx` for:

```tsx
<Environment files="/hdri/dusk-interior.hdr" environmentIntensity={LIGHTING.envIntensity} />
```

Keep the file under 4 MB — the 1k or 2k variants are plenty for a Quest Pro
demo and load much faster than the 4k+.
