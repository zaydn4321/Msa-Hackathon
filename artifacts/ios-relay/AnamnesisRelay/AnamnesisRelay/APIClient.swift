import Foundation

/// Lightweight URLSession wrapper for the Anamnesis API.
actor APIClient {

    private let session = URLSession.shared
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .iso8601
        return e
    }()
    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .iso8601
        return d
    }()

    // MARK: - Sessions

    func createSession(label: String?) async throws -> IntakeSession {
        var req = request(path: "/sessions", method: "POST")
        req.httpBody = try encoder.encode(["label": label])
        return try await perform(req)
    }

    func endSession(sessionId: Int) async throws -> IntakeSession {
        let req = request(path: "/sessions/\(sessionId)/end", method: "PATCH")
        return try await perform(req)
    }

    // MARK: - Biometrics

    func postBiometrics(sessionId: Int, readings: [BiometricReading]) async throws {
        var req = request(path: "/sessions/\(sessionId)/biometrics", method: "POST")
        req.httpBody = try encoder.encode(["readings": readings])
        let _: BiometricBatchResponse = try await perform(req)
    }

    func getBiometrics(sessionId: Int) async throws -> [BiometricReading] {
        let req = request(path: "/sessions/\(sessionId)/biometrics", method: "GET")
        return try await perform(req)
    }

    // MARK: - Helpers

    private func request(path: String, method: String) -> URLRequest {
        var req = URLRequest(url: Config.apiBaseURL.appendingPathComponent(path))
        req.httpMethod = method
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.timeoutInterval = 10
        return req
    }

    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw APIError.badStatus((response as? HTTPURLResponse)?.statusCode ?? -1, data)
        }
        return try decoder.decode(T.self, from: data)
    }
}

struct BiometricBatchResponse: Codable {
    let inserted: Int
}

enum APIError: LocalizedError {
    case badStatus(Int, Data)
    var errorDescription: String? {
        if case .badStatus(let code, let data) = self {
            let body = String(data: data, encoding: .utf8) ?? ""
            return "HTTP \(code): \(body)"
        }
        return nil
    }
}
