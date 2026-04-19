import SwiftUI

/// Simple Watch UI with Start/Stop button and live heart rate display.
/// Session state is primarily driven from the paired iPhone via WCSession;
/// the Stop button also works locally so the patient can end a session from the Watch.
struct WatchContentView: View {
    @ObservedObject var workoutManager: WorkoutManager

    var body: some View {
        VStack(spacing: 6) {
            if workoutManager.isRunning {
                VStack(spacing: 2) {
                    HStack(spacing: 4) {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.red)
                            .font(.caption)
                        Text("\(Int(workoutManager.heartRate))")
                            .font(.system(size: 28, weight: .bold, design: .rounded))
                        Text("bpm")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    if workoutManager.hrv > 0 {
                        Text("HRV \(Int(workoutManager.hrv)) ms")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }

                Button(action: { workoutManager.stopWorkout() }) {
                    Label("Stop", systemImage: "stop.fill")
                }
                .buttonStyle(.bordered)
                .tint(.red)
            } else {
                Image(systemName: "waveform.path.ecg")
                    .font(.title3)
                    .foregroundColor(.blue)

                // Session lifecycle is driven from the iPhone app.
                // The Start button is visible but inactive until the phone sends a start command.
                Button(action: {}) {
                    Label("Start", systemImage: "play.fill")
                }
                .buttonStyle(.bordered)
                .tint(.green)
                .disabled(true)

                Text("Start from\niPhone")
                    .font(.system(size: 10))
                    .multilineTextAlignment(.center)
                    .foregroundColor(.secondary)
            }
        }
        .padding(8)
    }
}
