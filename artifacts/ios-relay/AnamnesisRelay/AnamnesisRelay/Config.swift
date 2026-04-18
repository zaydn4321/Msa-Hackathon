import Foundation

/// Compile-time configuration for the Anamnesis Relay app.
/// Update `apiBaseURL` to point at your deployed Replit API.
enum Config {
    /// Base URL for the Anamnesis API server.
    /// In development this points at the Replit dev domain.
    /// For production, replace with your deployed .replit.app URL.
    static let apiBaseURL: URL = {
        let urlString = ProcessInfo.processInfo.environment["API_BASE_URL"]
            ?? "https://\(replitDevDomain)/api"
        return URL(string: urlString)!
    }()

    /// The Replit dev domain (set at build time or falls back to localhost).
    private static let replitDevDomain: String =
        ProcessInfo.processInfo.environment["REPLIT_DEV_DOMAIN"] ?? "localhost"
}
