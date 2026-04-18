# VR Scene Assets

The VR route (`/vr`) expects two GLB files here. Until they exist, the scene
renders with procedural/placeholder geometry defined in `src/vr/FallbackRoom.tsx`
and `src/vr/FallbackAvatar.tsx`, so you can iterate on the VR code without
blocking on art.

## `avatar.glb` — therapist avatar

Source from **Ready Player Me**: https://readyplayer.me

Export settings that match `src/vr/Avatar.tsx`:

- Body: **half-body** (fast) or **full-body** (richer idle motion).
- Morph targets: enable **ARKit blendshapes** (for `eyeBlinkLeft` / `eyeBlinkRight`)
  and **Oculus visemes** (for lip-sync once the voice pipeline lands).
- Pose: the avatar is placed at y=0 and expected to be seated — if the RPM export
  is in a T-pose it will look a bit stiff but still be usable for the demo.

Commit the exported `.glb` as `avatar.glb` at this path.

## `therapy-room.glb` — the room itself

Source options:

- **Poly Haven** (CC0): https://polyhaven.com/models — search for interior /
  office / living room.
- **Sketchfab CC-BY** exports — double-check attribution requirements before
  committing.

Target budget: **< 500k tris**, **< 8 MB**, baked lightmaps. Materials should
be matte (no reflective floors) so the Quest Pro GPU stays under budget.

To switch from the procedural fallback to the real room, edit
`src/vr/Scene.tsx` and replace `<FallbackRoom />` with `<TherapyRoom />` (already
imported-ready).
