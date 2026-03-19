import Foundation
import Observation
import SwiftUI
import FirebaseFirestore
import FirebaseAuth

@Observable
final class SettingsService {
    var settings: AppSettings = AppSettings()
    private let db = Firestore.firestore()
    private let cacheKey = "cachedAppSettings"

    static let availableAccentColors: [(name: String, hex: String)] = [
        ("Purple", "#7c3aed"),
        ("Blue", "#2563eb"),
        ("Green", "#059669"),
        ("Red", "#dc2626"),
        ("Amber", "#d97706"),
        ("Pink", "#db2777")
    ]

    var accentUIColor: Color {
        Color(hex: settings.accentColor) ?? .purple
    }

    private var settingsDocPath: String? {
        guard let uid = Auth.auth().currentUser?.uid else { return nil }
        return uid
    }

    init() {
        loadFromCache()
    }

    func loadSettings() async {
        guard let uid = settingsDocPath else { return }
        do {
            let document = try await db.collection("settings").document(uid).getDocument()
            if document.exists, let decoded = try? document.data(as: AppSettings.self) {
                settings = decoded
                saveToCache()
            }
        } catch {
            print("Error loading settings: \(error.localizedDescription)")
        }
    }

    func saveSettings() async throws {
        guard let uid = settingsDocPath else { return }
        try db.collection("settings").document(uid).setData(from: settings, merge: true)
        saveToCache()
    }

    // MARK: - Cache

    private func loadFromCache() {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let cached = AppSettings.decoded(from: data) else { return }
        settings = cached
    }

    private func saveToCache() {
        if let data = settings.encoded() {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }
}
