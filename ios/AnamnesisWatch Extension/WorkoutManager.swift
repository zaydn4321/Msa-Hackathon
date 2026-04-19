import Foundation
import HealthKit
import WatchConnectivity

/// Manages an HKWorkoutSession on Apple Watch, collects live HR and HRV samples,
/// and sends them to the paired iPhone in a single batch message every 5 seconds.
class WorkoutManager: NSObject, ObservableObject {
    private let healthStore = HKHealthStore()
    private var workoutSession: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?

    /// Timer that fires every 5 seconds to flush the accumulated sample buffer.
    private var batchTimer: Timer?

    /// Accumulated samples waiting to be sent on the next 5-second flush.
    private var pendingSamples: [[String: Any]] = []

    /// Callback invoked by the flush timer with a batch payload to send to the phone.
    var onSendBatch: ([[String: Any]]) -> Void = { _ in }

    @Published var heartRate: Double = 0
    @Published var hrv: Double = 0
    @Published var isRunning: Bool = false

    // MARK: - Authorization

    func requestAuthorization(completion: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            completion(false)
            return
        }
        let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!

        healthStore.requestAuthorization(
            toShare: [HKObjectType.workoutType()],
            read: [hrType, hrvType]
        ) { success, _ in
            completion(success)
        }
    }

    // MARK: - Session lifecycle

    func startWorkout(sessionId: Int) {
        guard !isRunning else { return }

        let config = HKWorkoutConfiguration()
        config.activityType = .mindAndBody
        config.locationType = .indoor

        do {
            workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: config)
            builder = workoutSession?.associatedWorkoutBuilder()
        } catch {
            return
        }

        builder?.dataSource = HKLiveWorkoutDataSource(
            healthStore: healthStore,
            workoutConfiguration: config
        )
        workoutSession?.delegate = self
        builder?.delegate = self

        let startDate = Date()
        workoutSession?.startActivity(with: startDate)
        builder?.beginCollection(withStart: startDate) { _, _ in }

        DispatchQueue.main.async {
            self.isRunning = true
        }

        batchTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.flushBatch()
        }
    }

    func stopWorkout() {
        batchTimer?.invalidate()
        batchTimer = nil
        flushBatch()

        workoutSession?.end()
        builder?.endCollection(withEnd: Date()) { [weak self] _, _ in
            self?.builder?.finishWorkout { _, _ in }
        }

        DispatchQueue.main.async {
            self.isRunning = false
        }
    }

    // MARK: - Batch flush

    /// Drains `pendingSamples` and sends a single WCSession batch message to the iPhone.
    private func flushBatch() {
        guard !pendingSamples.isEmpty else { return }
        let batch = pendingSamples
        pendingSamples = []
        onSendBatch(batch)
    }

    // MARK: - Sample collection

    private func record(metric: String, value: Double, date: Date) {
        let entry: [String: Any] = [
            "metric": metric,
            "value": value,
            "recordedAt": date.timeIntervalSince1970,
        ]
        pendingSamples.append(entry)
    }
}

// MARK: - HKWorkoutSessionDelegate

extension WorkoutManager: HKWorkoutSessionDelegate {
    func workoutSession(_ workoutSession: HKWorkoutSession,
                        didChangeTo toState: HKWorkoutSessionState,
                        from fromState: HKWorkoutSessionState,
                        date: Date) {}

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {}
}

// MARK: - HKLiveWorkoutBuilderDelegate

extension WorkoutManager: HKLiveWorkoutBuilderDelegate {
    func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder,
                        didCollectDataOf collectedTypes: Set<HKSampleType>) {
        let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate)!
        let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!

        if collectedTypes.contains(hrType),
           let stats = workoutBuilder.statistics(for: hrType),
           let qty = stats.mostRecentQuantity() {
            let bpm = qty.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
            if bpm > 0 {
                DispatchQueue.main.async { self.heartRate = bpm }
                record(metric: "HR", value: bpm, date: stats.mostRecentQuantityDateInterval()?.end ?? Date())
            }
        }

        if collectedTypes.contains(hrvType),
           let stats = workoutBuilder.statistics(for: hrvType),
           let qty = stats.mostRecentQuantity() {
            let ms = qty.doubleValue(for: .millisecond())
            if ms > 0 {
                DispatchQueue.main.async { self.hrv = ms }
                record(metric: "HRV", value: ms, date: stats.mostRecentQuantityDateInterval()?.end ?? Date())
            }
        }
    }
}
