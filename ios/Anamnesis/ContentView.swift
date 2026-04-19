import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var watchConnectivity: WatchConnectivityManager
    @StateObject private var apiClient = BiometricAPIClient()

    @State private var sessionIdText: String = ""
    @State private var isSessionActive: Bool = false
    @State private var statusMessage: String = "Enter a Session ID to begin."
    @State private var latestHR: Double? = nil
    @State private var latestHRV: Double? = nil

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Session")) {
                    TextField("Session ID", text: $sessionIdText)
                        .keyboardType(.numberPad)
                        .disabled(isSessionActive)
                }

                Section(header: Text("Controls")) {
                    if !isSessionActive {
                        Button(action: startSession) {
                            Label("Start Session", systemImage: "play.fill")
                                .foregroundColor(.green)
                        }
                        .disabled(sessionIdText.trimmingCharacters(in: .whitespaces).isEmpty)
                    } else {
                        Button(action: stopSession) {
                            Label("Stop Session", systemImage: "stop.fill")
                                .foregroundColor(.red)
                        }
                    }
                }

                Section(header: Text("Latest Readings")) {
                    HStack {
                        Image(systemName: "heart.fill")
                            .foregroundColor(.red)
                        Text("Heart Rate")
                        Spacer()
                        Text(latestHR.map { "\(Int($0)) bpm" } ?? "—")
                            .foregroundColor(.secondary)
                    }
                    HStack {
                        Image(systemName: "waveform.path.ecg")
                            .foregroundColor(.blue)
                        Text("HRV")
                        Spacer()
                        Text(latestHRV.map { "\(Int($0)) ms" } ?? "—")
                            .foregroundColor(.secondary)
                    }
                }

                Section(header: Text("Status")) {
                    Text(statusMessage)
                        .foregroundColor(.secondary)
                        .font(.footnote)
                }
            }
            .navigationTitle("Anamnesis")
        }
        .onReceive(watchConnectivity.$latestReading) { reading in
            guard let reading = reading else { return }
            if reading.metric == "HR" { latestHR = reading.value }
            if reading.metric == "HRV" { latestHRV = reading.value }
        }
        .onReceive(watchConnectivity.$pendingBatch) { batch in
            guard isSessionActive, let sessionId = Int(sessionIdText.trimmingCharacters(in: .whitespaces)), !batch.isEmpty else { return }
            let batchToUpload = batch
            // Clear immediately so new Watch readings accumulate for the next cycle.
            watchConnectivity.clearPendingBatch()
            apiClient.postBiometrics(sessionId: sessionId, readings: batchToUpload) { result in
                DispatchQueue.main.async {
                    switch result {
                    case .success(let count):
                        statusMessage = "Uploaded \(count) reading(s) from Apple Watch."
                    case .failure(let error):
                        // Re-queue failed readings so they are retried on the next batch.
                        watchConnectivity.restoreFailedReadings(batchToUpload)
                        statusMessage = "Upload failed: \(error.localizedDescription)"
                    }
                }
            }
        }
    }

    private func startSession() {
        guard let sessionId = Int(sessionIdText.trimmingCharacters(in: .whitespaces)) else {
            statusMessage = "Invalid Session ID."
            return
        }
        // Clear any stale readings from a previous session before activating.
        watchConnectivity.clearPendingBatch()
        isSessionActive = true
        latestHR = nil
        latestHRV = nil
        statusMessage = "Session \(sessionId) active — waiting for Apple Watch data…"
        watchConnectivity.sendCommand("start", sessionId: sessionId)
    }

    private func stopSession() {
        guard let sessionId = Int(sessionIdText.trimmingCharacters(in: .whitespaces)) else { return }
        // Upload any readings that arrived before the stop command before deactivating.
        let remainingBatch = watchConnectivity.pendingBatch
        if !remainingBatch.isEmpty {
            watchConnectivity.clearPendingBatch()
            apiClient.postBiometrics(sessionId: sessionId, readings: remainingBatch) { _ in }
        }
        isSessionActive = false
        statusMessage = "Session \(sessionId) stopped."
        watchConnectivity.sendCommand("stop", sessionId: sessionId)
    }
}

#Preview {
    ContentView()
        .environmentObject(WatchConnectivityManager())
}
