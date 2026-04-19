import SwiftUI
import WatchConnectivity

@main
struct AnamnesisWatchApp: App {
    @StateObject private var workoutManager = WorkoutManager()
    @StateObject private var sessionManager = WatchSessionManager()

    var body: some Scene {
        WindowGroup {
            WatchContentView(workoutManager: workoutManager)
                .onAppear {
                    sessionManager.setup(workoutManager: workoutManager)
                    workoutManager.requestAuthorization { _ in }
                }
        }
    }
}

/// Manages the WCSession on the Watch side.
/// - Receives start/stop commands from the iPhone.
/// - Forwards 5-second batches of HR/HRV samples to the iPhone.
class WatchSessionManager: NSObject, ObservableObject, WCSessionDelegate {
    private weak var workoutManager: WorkoutManager?

    func setup(workoutManager: WorkoutManager) {
        self.workoutManager = workoutManager
        workoutManager.onSendBatch = { [weak self] batch in
            self?.sendBatchToPhone(batch)
        }
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Send batch to iPhone

    /// Sends a batch of readings to the iPhone.
    /// Uses `sendMessage` when the phone is reachable (low latency),
    /// and falls back to `transferUserInfo` when the phone is in the background
    /// so readings are not dropped.
    private func sendBatchToPhone(_ batch: [[String: Any]]) {
        let payload: [String: Any] = ["batch": batch]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(payload, replyHandler: nil, errorHandler: { [weak self] _ in
                // sendMessage failed — fall back to guaranteed delivery queue
                self?.transferUserInfoFallback(payload)
            })
        } else {
            transferUserInfoFallback(payload)
        }
    }

    private func transferUserInfoFallback(_ payload: [String: Any]) {
        WCSession.default.transferUserInfo(payload)
    }

    // MARK: - Receive commands from iPhone

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        handleCommand(message)
    }

    /// Handles commands delivered via `updateApplicationContext` fallback.
    func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        handleCommand(applicationContext)
    }

    private func handleCommand(_ payload: [String: Any]) {
        guard let command = payload["command"] as? String else { return }
        let sessionId = payload["sessionId"] as? Int ?? 0
        DispatchQueue.main.async {
            if command == "start" {
                self.workoutManager?.startWorkout(sessionId: sessionId)
            } else if command == "stop" {
                self.workoutManager?.stopWorkout()
            }
        }
    }

    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {}
}
