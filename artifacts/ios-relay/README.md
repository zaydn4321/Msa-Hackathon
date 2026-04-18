# Anamnesis Relay — iOS + watchOS

Streams live Heart Rate (HR) and Heart Rate Variability (HRV) from an Apple Watch to the Anamnesis API server during an intake session.

## Architecture

```
Apple Watch (HealthKit workout session)
    └─ HKAnchoredObjectQuery (every ~5 s)
        └─ WatchConnectivity (WCSession)
            └─ iPhone App (SessionManager)
                └─ URLSession → POST /api/sessions/:id/biometrics
```

## Setup

### Requirements

- Xcode 15 or later
- An iPhone paired with an Apple Watch Series 4 or later (watchOS 7+)
- A development Apple ID enrolled in the Apple Developer Program

### Steps

1. **Open the project**
   ```bash
   open artifacts/ios-relay/AnamnesisRelay/AnamnesisRelay.xcodeproj
   ```

2. **Enable HealthKit entitlements**  
   - Select the `AnamnesisRelay` target → *Signing & Capabilities* → `+ Capability` → **HealthKit**  
   - Repeat for the `AnamnesisRelayWatch` Extension target

3. **Enable Background Modes** (optional, for workout sessions)  
   - `AnamnesisRelayWatch` target → *Background Modes* → check **Workout processing**

4. **Point the app at your API**  
   Open `AnamnesisRelay/Config.swift` and update `apiBaseURL` if needed.  
   By default it reads the `REPLIT_DEV_DOMAIN` environment variable, which works when running from Replit. For production, set:
   ```swift
   static let apiBaseURL = URL(string: "https://your-app.replit.app/api")!
   ```
   Or set the `API_BASE_URL` environment variable in the Xcode scheme.

5. **Select your physical device** (HealthKit does not work in Simulator).

6. **Run** (`⌘R`) — the app installs on both iPhone and Apple Watch automatically.

## Usage

1. Launch the app on your iPhone
2. Tap **Start Session** — this creates a session on the API and starts the Watch workout
3. Live HR and HRV values appear on both the iPhone and Watch screens
4. Tap **End Session** when the intake interview is complete
5. Retrieve biometric data via `GET /api/sessions/:id/biometrics`

## API Endpoints Used

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/sessions` | Create a new intake session |
| POST | `/api/sessions/:id/biometrics` | Upload a batch of readings |
| PATCH | `/api/sessions/:id/end` | Close the session |
| GET | `/api/sessions/:id/biometrics` | Retrieve all readings |
