import Foundation
import Combine
import WatchConnectivity

/// Manages the lifecycle of a biometric intake session with the API server.
/// Also owns WCSession setup so watch commands flow through one place.
@MainActor
final class SessionManager: NSObject, ObservableObject {

    // MARK: - Published State

    @Published private(set) var sessionId: Int?
    @Published private(set) var isActive: Bool = false
    @Published private(set) var latestHR: Double?
    @Published private(set) var latestHRV: Double?
    @Published private(set) var errorMessage: String?

    // MARK: - Private

    private let api = APIClient()
    private var pendingReadings: [BiometricReading] = []
    private var flushTimer: Timer?

    // MARK: - Init

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Session Lifecycle

    func startSession(label: String? = nil) async {
        errorMessage = nil
        do {
            let session = try await api.createSession(label: label)
            sessionId = session.id
            isActive = true
            startFlushTimer()
            sendWatchCommand("start")
        } catch {
            errorMessage = "Failed to start session: \(error.localizedDescription)"
        }
    }

    func endSession() async {
        guard let id = sessionId else { return }
        sendWatchCommand("stop")
        flushTimer?.invalidate()
        flushTimer = nil
        await flushReadings()
        do {
            _ = try await api.endSession(sessionId: id)
        } catch {
            errorMessage = "Failed to end session: \(error.localizedDescription)"
        }
        isActive = false
    }

    // MARK: - Reading Ingestion (called via WCSession delegate)

    func receiveReadings(_ readings: [BiometricReading]) {
        pendingReadings.append(contentsOf: readings)
        for r in readings {
            if r.metric == "HR" { latestHR = r.value }
            if r.metric == "HRV" { latestHRV = r.value }
        }
    }

    // MARK: - Private Helpers

    private func sendWatchCommand(_ command: String) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["command": command], replyHandler: nil, errorHandler: nil)
    }

    private func startFlushTimer() {
        flushTimer = Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                await self?.flushReadings()
            }
        }
    }

    private func flushReadings() async {
        guard let id = sessionId, !pendingReadings.isEmpty else { return }
        let batch = pendingReadings
        pendingReadings = []
        do {
            try await api.postBiometrics(sessionId: id, readings: batch)
        } catch {
            pendingReadings.insert(contentsOf: batch, at: 0)
            errorMessage = "Failed to upload readings: \(error.localizedDescription)"
        }
    }
}

// MARK: - WCSessionDelegate

extension SessionManager: WCSessionDelegate {

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    nonisolated func sessionDidDeactivate(_ session: WCSession) {
        WCSession.default.activate()
    }

    /// Receives biometric readings relayed from the Apple Watch.
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let rawReadings = message["readings"] as? [[String: Any]] else { return }
        let readings = rawReadings.compactMap { dict -> BiometricReading? in
            guard
                let metric = dict["metric"] as? String,
                let value = dict["value"] as? Double,
                let recordedAt = dict["recordedAt"] as? String
            else { return nil }
            return BiometricReading(metric: metric, value: value, recordedAt: recordedAt)
        }
        Task { @MainActor in
            self.receiveReadings(readings)
        }
    }
}

// MARK: - Data Models

struct BiometricReading: Codable {
    let metric: String   // "HR" or "HRV"
    let value: Double
    let recordedAt: String  // ISO8601
}

struct IntakeSession: Codable {
    let id: Int
    let label: String?
    let startedAt: String
    let endedAt: String?
}
