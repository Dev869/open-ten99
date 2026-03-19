import Foundation

struct AppSettings: Codable, Sendable {
    var accentColor: String
    var hourlyRate: Double
    var companyName: String
    var pdfLogoUrl: String?

    enum CodingKeys: String, CodingKey {
        case accentColor
        case hourlyRate
        case companyName
        case pdfLogoUrl
    }

    init(
        accentColor: String = "#7c3aed",
        hourlyRate: Double = 150.0,
        companyName: String = "",
        pdfLogoUrl: String? = nil
    ) {
        self.accentColor = accentColor
        self.hourlyRate = hourlyRate
        self.companyName = companyName
        self.pdfLogoUrl = pdfLogoUrl
    }

    /// Encodes the settings to JSON data for UserDefaults caching.
    func encoded() -> Data? {
        try? JSONEncoder().encode(self)
    }

    /// Decodes settings from cached JSON data.
    static func decoded(from data: Data) -> AppSettings? {
        try? JSONDecoder().decode(AppSettings.self, from: data)
    }
}
