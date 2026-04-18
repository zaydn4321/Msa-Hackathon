import SwiftUI

@main
struct AnamnesisRelayApp: App {
    /// Single source of truth for session state, shared across the app.
    /// SessionManager also owns WCSession setup and watch relay receiving.
    @StateObject private var sessionManager = SessionManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
        }
    }
}
