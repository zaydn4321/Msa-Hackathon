import SwiftUI
import WatchConnectivity

struct WatchContentView: View {
    @StateObject private var delegate = WatchSessionDelegate()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // Live metrics
                HStack {
                    MetricPill(label: "HR", value: delegate.currentHR.map { "\(Int($0))" } ?? "--", unit: "bpm")
                    MetricPill(label: "HRV", value: delegate.currentHRV.map { String(format: "%.0f", $0) } ?? "--", unit: "ms")
                }

                // Status indicator
                Circle()
                    .fill(delegate.isRunning ? Color.green : Color.gray)
                    .frame(width: 8, height: 8)

                // Control button
                Button {
                    Task {
                        if delegate.isRunning {
                            await delegate.stopSession()
                        } else {
                            try? await delegate.requestAuthorization()
                            await delegate.startSession()
                        }
                    }
                } label: {
                    Text(delegate.isRunning ? "Stop" : "Start")
                        .frame(maxWidth: .infinity)
                }
                .tint(delegate.isRunning ? .red : .green)

                if let error = delegate.errorMessage {
                    Text(error)
                        .font(.system(size: 10))
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                }
            }
            .padding(.horizontal, 8)
        }
        .navigationTitle("Anamnesis")
    }
}

struct MetricPill: View {
    let label: String
    let value: String
    let unit: String

    var body: some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 20, weight: .bold, design: .rounded))
            Text(unit)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
        .background(Color(.darkGray).opacity(0.3))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
