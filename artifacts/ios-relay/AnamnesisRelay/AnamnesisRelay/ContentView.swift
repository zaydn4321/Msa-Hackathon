import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: SessionManager

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                // Header
                VStack(spacing: 4) {
                    Text("Anamnesis")
                        .font(.largeTitle.bold())
                    Text("Biometric Relay")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 24)

                // Live Metrics
                HStack(spacing: 24) {
                    MetricCard(
                        title: "Heart Rate",
                        value: session.latestHR.map { "\(Int($0))" } ?? "--",
                        unit: "bpm",
                        color: .red,
                        isActive: session.isActive
                    )
                    MetricCard(
                        title: "HRV",
                        value: session.latestHRV.map { String(format: "%.1f", $0) } ?? "--",
                        unit: "ms",
                        color: .indigo,
                        isActive: session.isActive
                    )
                }
                .padding(.horizontal)

                // Session Status
                VStack(spacing: 8) {
                    Circle()
                        .fill(session.isActive ? Color.green : Color.gray.opacity(0.4))
                        .frame(width: 12, height: 12)
                        .animation(
                            session.isActive
                                ? .easeInOut(duration: 0.8).repeatForever(autoreverses: true)
                                : .default,
                            value: session.isActive
                        )

                    Text(session.isActive ? "Session Active" : "No Active Session")
                        .font(.callout)
                        .foregroundStyle(.secondary)

                    if let id = session.sessionId {
                        Text("Session #\(id)")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                }

                // Error
                if let error = session.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                // Controls
                Button {
                    Task {
                        if session.isActive {
                            await session.endSession()
                        } else {
                            await session.startSession(
                                label: "Intake \(Date().formatted(date: .abbreviated, time: .shortened))"
                            )
                        }
                    }
                } label: {
                    Label(
                        session.isActive ? "End Session" : "Start Session",
                        systemImage: session.isActive ? "stop.fill" : "play.fill"
                    )
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(session.isActive ? Color.red : Color.accentColor)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct MetricCard: View {
    let title: String
    let value: String
    let unit: String
    let color: Color
    let isActive: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            HStack(alignment: .lastTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundStyle(isActive ? color : .secondary)
                    .contentTransition(.numericText())
                Text(unit)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }
}

#Preview {
    ContentView()
        .environmentObject(SessionManager())
}
