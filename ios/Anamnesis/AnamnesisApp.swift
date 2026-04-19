import SwiftUI

@main
struct AnamnesisApp: App {
    @StateObject private var watchConnectivity = WatchConnectivityManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(watchConnectivity)
        }
    }
}
