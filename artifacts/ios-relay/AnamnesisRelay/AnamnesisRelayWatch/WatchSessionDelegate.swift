import Foundation
import HealthKit
import WatchConnectivity

/// watchOS extension: starts an HKWorkoutSession when commanded by the iOS app,
/// queries live HR and HRV every ~5 s via HKAnchoredObjectQuery, and relays
/// readings back to the iPhone via WCSession.
@MainActor
final class WatchSessionDelegate: NSObject, ObservableObject {

    // MARK: - Published State

    @Published private(set) var isRunning = false
    @Published private(set) var currentHR: Double?
    @Published private(set) var currentHRV: Double?
    @Published private(set) var errorMessage: String?

    // MARK: - Private

    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var liveWorkoutBuilder: HKLiveWorkoutBuilder?
    private var hrQuery: HKAnchoredObjectQuery?
    private var hrvQuery: HKAnchoredObjectQuery?

    private let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    // MARK: - Init

    override init() {
        super.init()
        if WCSession.isSupported() {
            WCSession.default.delegate = self
            WCSession.default.activate()
        }
    }

    // MARK: - Authorization

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw HealthError.notAvailable
        }
        let hrType = HKQuantityType(.heartRate)
        let hrvType = HKQuantityType(.heartRateVariabilitySDNN)
        let workoutType = HKObjectType.workoutType()
        try await healthStore.requestAuthorization(
            toShare: [workoutType],
            read: [hrType, hrvType]
        )
    }

    // MARK: - Session Lifecycle

    func startSession() async {
        errorMessage = nil
        let config = HKWorkoutConfiguration()
        config.activityType = .mindAndBody
        config.locationType = .indoor

        do {
            let session = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            let builder = session.associatedWorkoutBuilder()
            builder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: config
            )
            self.workoutSession = session
            self.liveWorkoutBuilder = builder

            session.startActivity(with: Date())
            try await builder.beginCollection(at: Date())

            isRunning = true
            startAnchoredQueries()
        } catch {
            errorMessage = "Could not start workout session: \(error.localizedDescription)"
        }
    }

    func stopSession() async {
        stopAnchoredQueries()
        workoutSession?.end()
        try? await liveWorkoutBuilder?.endCollection(at: Date())
        try? await liveWorkoutBuilder?.finishWorkout()
        isRunning = false
        currentHR = nil
        currentHRV = nil
    }

    // MARK: - Anchored Object Queries

    private func startAnchoredQueries() {
        hrQuery = makeAnchoredQuery(
            for: HKQuantityType(.heartRate),
            metric: "HR",
            unit: HKUnit(from: "count/min")
        )
        hrvQuery = makeAnchoredQuery(
            for: HKQuantityType(.heartRateVariabilitySDNN),
            metric: "HRV",
            unit: HKUnit(from: "ms")
        )
        healthStore.execute(hrQuery!)
        healthStore.execute(hrvQuery!)
    }

    private func stopAnchoredQueries() {
        if let q = hrQuery { healthStore.stop(q) }
        if let q = hrvQuery { healthStore.stop(q) }
    }

    private func makeAnchoredQuery(
        for type: HKQuantityType,
        metric: String,
        unit: HKUnit
    ) -> HKAnchoredObjectQuery {
        var anchor: HKQueryAnchor?
        let query = HKAnchoredObjectQuery(
            type: type,
            predicate: HKQuery.predicateForSamples(withStart: Date(), end: nil),
            anchor: anchor,
            limit: HKObjectQueryNoLimit
        ) { [weak self] _, samples, _, newAnchor, _ in
            anchor = newAnchor
            Task { @MainActor [weak self] in
                self?.processSamples(samples as? [HKQuantitySample], metric: metric, unit: unit)
            }
        }
        query.updateHandler = { [weak self] _, samples, _, newAnchor, _ in
            anchor = newAnchor
            Task { @MainActor [weak self] in
                self?.processSamples(samples as? [HKQuantitySample], metric: metric, unit: unit)
            }
        }
        return query
    }

    private func processSamples(_ samples: [HKQuantitySample]?, metric: String, unit: HKUnit) {
        guard let samples, !samples.isEmpty else { return }
        var readings: [[String: Any]] = []
        for sample in samples {
            let value = sample.quantity.doubleValue(for: unit)
            if metric == "HR" { currentHR = value }
            if metric == "HRV" { currentHRV = value }
            readings.append([
                "metric": metric,
                "value": value,
                "recordedAt": isoFormatter.string(from: sample.endDate),
            ])
        }
        relayToPhone(readings: readings)
    }

    // MARK: - Phone Relay

    private func relayToPhone(readings: [[String: Any]]) {
        guard WCSession.default.isReachable else { return }
        WCSession.default.sendMessage(["readings": readings], replyHandler: nil, errorHandler: nil)
    }
}

// MARK: - WCSessionDelegate

extension WatchSessionDelegate: WCSessionDelegate {

    nonisolated func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    /// Receives "start"/"stop" commands sent by the iOS companion app.
    nonisolated func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let command = message["command"] as? String else { return }
        Task { @MainActor in
            switch command {
            case "start":
                try? await self.requestAuthorization()
                await self.startSession()
            case "stop":
                await self.stopSession()
            default:
                break
            }
        }
    }
}

// MARK: - Error

enum HealthError: LocalizedError {
    case notAvailable
    var errorDescription: String? { "HealthKit is not available on this device." }
}
