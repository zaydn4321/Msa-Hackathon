import Foundation

struct BiometricReadingPayload: Encodable {
    let metric: String
    let value: Double
    let recordedAt: String
}

struct BiometricBatchPayload: Encodable {
    let readings: [BiometricReadingPayload]
}

struct BiometricBatchResponse: Decodable {
    let inserted: Int
}

class BiometricAPIClient: ObservableObject {
    private let session = URLSession.shared
    private let encoder = JSONEncoder()

    private var baseURL: String {
        guard let path = Bundle.main.path(forResource: "Config", ofType: "plist"),
              let dict = NSDictionary(contentsOfFile: path),
              let url = dict["APIBaseURL"] as? String else {
            return "https://your-app.replit.app/api"
        }
        return url.hasSuffix("/") ? String(url.dropLast()) : url
    }

    func postBiometrics(sessionId: Int, readings: [BiometricSample], completion: @escaping (Result<Int, Error>) -> Void) {
        let iso8601 = ISO8601DateFormatter()
        let payload = BiometricBatchPayload(
            readings: readings.map {
                BiometricReadingPayload(
                    metric: $0.metric,
                    value: $0.value,
                    recordedAt: iso8601.string(from: $0.recordedAt)
                )
            }
        )

        guard let url = URL(string: "\(baseURL)/sessions/\(sessionId)/biometrics") else {
            completion(.failure(URLError(.badURL)))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try JSONEncoder().encode(payload)
        } catch {
            completion(.failure(error))
            return
        }

        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            if let httpResponse = response as? HTTPURLResponse,
               !(200...299).contains(httpResponse.statusCode) {
                completion(.failure(URLError(.badServerResponse)))
                return
            }
            guard let data = data else {
                completion(.failure(URLError(.zeroByteResource)))
                return
            }
            do {
                let decoded = try JSONDecoder().decode(BiometricBatchResponse.self, from: data)
                completion(.success(decoded.inserted))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}
