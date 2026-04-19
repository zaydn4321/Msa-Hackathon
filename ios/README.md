# Anamnesis iOS + Apple Watch App

A native Swift companion app that streams real-time Heart Rate and HRV data from an Apple Watch to an Anamnesis intake session.

## What it does

- The patient wears an Apple Watch running the Watch app.
- The therapist runs the session in the Anamnesis web browser.
- The iPhone app connects to the Watch and POSTs biometric readings every 5 seconds to the Anamnesis API, replacing the server-side simulator with real data.

## Project structure

```
ios/
├── Anamnesis.xcodeproj/          Xcode project file
├── Anamnesis/                    iPhone app
│   ├── AnamnesisApp.swift        App entry point
│   ├── ContentView.swift         Session ID screen (Start / Stop)
│   ├── WatchConnectivityManager.swift  Receives readings from Watch via WCSession
│   ├── BiometricAPIClient.swift  POSTs batched readings to the API
│   ├── Config.plist              API base URL (edit this to point at your deployment)
│   ├── Info.plist
│   └── Anamnesis.entitlements
├── AnamnesisWatch/               WatchKit App shell
│   └── Info.plist
└── AnamnesisWatch Extension/     WatchKit Extension (all the logic lives here)
    ├── AnamnesisWatchApp.swift   Watch app entry point + WCSession manager
    ├── WatchContentView.swift    Simple HR display on the Watch face
    ├── WorkoutManager.swift      HKWorkoutSession + HKLiveWorkoutBuilder
    └── Info.plist
```

## Opening in Xcode

1. Open `ios/Anamnesis.xcodeproj` in Xcode (version 15 or later recommended).
2. Select the **Anamnesis** scheme in the toolbar.
3. In the **Signing & Capabilities** tab for each target, set your **Development Team**.
4. Connect your iPhone and Apple Watch (watch must be paired to the phone).
5. Build and run on your iPhone — the Watch extension will be installed automatically.

## Pointing at your API

Edit `ios/Anamnesis/Config.plist` and replace the placeholder URL:

```xml
<key>APIBaseURL</key>
<string>https://YOUR-REPLIT-APP.replit.app/api</string>
```

No code changes are required — the app reads `APIBaseURL` at runtime.

## Using the app

1. In the Anamnesis web app, create a new session and note the **Session ID**.
2. Open the Anamnesis iPhone app, enter the Session ID, and tap **Start Session**.
3. The Watch will prompt you to allow HealthKit access (Heart Rate & Workouts) on first run.
4. After granting access, the Watch starts a workout session and streams readings every 5 seconds.
5. When the session is complete, tap **Stop Session** on the iPhone.

## API endpoint

Biometric readings are sent to:

```
POST /api/sessions/:sessionId/biometrics
Content-Type: application/json

{
  "readings": [
    { "metric": "HR",  "value": 72, "recordedAt": "2026-04-18T10:00:00Z" },
    { "metric": "HRV", "value": 45, "recordedAt": "2026-04-18T10:00:00Z" }
  ]
}
```

The endpoint does **not** require a login cookie — the session ID in the URL is sufficient.

## Entitlements required

Both targets need HealthKit enabled. In Xcode:

- Anamnesis (iOS): **HealthKit** capability
- AnamnesisWatch Extension: **HealthKit** capability

These are pre-configured in the `.entitlements` files; Xcode will prompt you to confirm them when you first build with a real development team.

## Simulator limitations

- `HKWorkoutSession` requires a **real Apple Watch** — it cannot run in the simulator.
- WatchConnectivity also requires a paired physical device pair.
- For simulator testing, use the existing server-side biometric simulator (still active when no iOS app is connected).
