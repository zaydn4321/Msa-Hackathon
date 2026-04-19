import Foundation
import WatchConnectivity
import Combine

struct BiometricSample: Codable {
    let metric: String
    let value: Double
    let recordedAt: Date
}

/// Manages the WCSession on the iPhone side.
/// - Sends start/stop commands to the Apple Watch.
/// - Receives 5-second batches of HR/HRV samples from the Watch and exposes
///   them to the UI as a `pendingBatch` that is posted to the API then cleared.
class WatchConnectivityManager: NSObject, ObservableObject, WCSessionDelegate {

    /// The most recently received individual sample (used for live UI display).
    @Published var latestReading: BiometricSample? = nil

    /// Accumulated samples received since the last API upload.
    /// ContentView observes this and triggers a POST when it becomes non-empty.
    @Published var pendingBatch: [BiometricSample] = []

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Commands to Watch

    /// Sends a start/stop command to the Watch.
    /// Uses `sendMessage` when the Watch is reachable (immediate delivery),
    /// and falls back to `updateApplicationContext` so the Watch picks up the
    /// command when the extension next becomes active.
    func sendCommand(_ command: String, sessionId: Int) {
        let message: [String: Any] = ["command": command, "sessionId": sessionId]
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(message, replyHandler: nil) { [weak self] _ in
                self?.updateApplicationContextFallback(message)
            }
        } else {
            updateApplicationContextFallback(message)
        }
    }

    private func updateApplicationContextFallback(_ context: [String: Any]) {
        try? WCSession.default.updateApplicationContext(context)
    }

    // MARK: - Batch management

    func clearPendingBatch() {
        DispatchQueue.main.async {
            self.pendingBatch = []
        }
    }

    /// Re-queues readings at the front of `pendingBatch` after a failed upload,
    /// so they are included in the next retry.
    func restoreFailedReadings(_ readings: [BiometricSample]) {
        DispatchQueue.main.async {
            self.pendingBatch = readings + self.pendingBatch
        }
    }

    // MARK: - WCSessionDelegate

    /// The Watch sends a single message per 5-second interval containing a
    /// "batch" key with an array of reading dictionaries.
    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let rawBatch = message["batch"] as? [[String: Any]] else { return }

        let samples: [BiometricSample] = rawBatch.compactMap { entry in
            guard let metric = entry["metric"] as? String,
                  let value = entry["value"] as? Double,
                  let ts = entry["recordedAt"] as? TimeInterval else { return nil }
            return BiometricSample(metric: metric, value: value, recordedAt: Date(timeIntervalSince1970: ts))
        }
        guard !samples.isEmpty else { return }

        DispatchQueue.main.async {
            self.latestReading = samples.last
            self.pendingBatch.append(contentsOf: samples)
        }
    }

    /// Handles `transferUserInfo` deliveries sent as a fallback when `sendMessage`
    /// was not available (e.g. phone was backgrounded during the Watch batch flush).
    func session(_ session: WCSession, didReceiveUserInfo userInfo: [String: Any]) {
        self.session(session, didReceiveMessage: userInfo)
    }

    func session(_ session: WCSession,
                 activationDidCompleteWith activationState: WCSessionActivationState,
                 error: Error?) {}
    func sessionDidBecomeInactive(_ session: WCSession) {}
    func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }
}
