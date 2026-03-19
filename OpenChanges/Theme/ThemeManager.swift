import Foundation
import Observation
import SwiftUI

struct AccentColorOption: Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let hex: String
    let color: Color

    init(name: String, hex: String) {
        self.id = hex
        self.name = name
        self.hex = hex
        self.color = Color(hex: hex) ?? .purple
    }
}

@Observable
final class ThemeManager {
    static let shared = ThemeManager()

    var accentColor: Color = .purple

    static let availableColors: [AccentColorOption] = [
        AccentColorOption(name: "Purple", hex: "#7c3aed"),
        AccentColorOption(name: "Blue", hex: "#2563eb"),
        AccentColorOption(name: "Green", hex: "#059669"),
        AccentColorOption(name: "Red", hex: "#dc2626"),
        AccentColorOption(name: "Amber", hex: "#d97706"),
        AccentColorOption(name: "Pink", hex: "#db2777")
    ]

    private init() {}

    func updateAccentColor(from hex: String) {
        accentColor = Color(hex: hex) ?? .purple
    }
}

// MARK: - Color Hex Extension

extension Color {
    /// Initializes a Color from a hex string (e.g. "#7c3aed" or "7c3aed").
    init?(hex: String) {
        var hexString = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if hexString.hasPrefix("#") {
            hexString.removeFirst()
        }

        guard hexString.count == 6,
              let hexNumber = UInt64(hexString, radix: 16) else {
            return nil
        }

        let r = Double((hexNumber & 0xFF0000) >> 16) / 255.0
        let g = Double((hexNumber & 0x00FF00) >> 8) / 255.0
        let b = Double(hexNumber & 0x0000FF) / 255.0

        self.init(red: r, green: g, blue: b)
    }

    /// Converts the Color back to a hex string.
    func toHex() -> String? {
        #if os(iOS)
        let uiColor = UIColor(self)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        uiColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        #else
        let nsColor = NSColor(self).usingColorSpace(.sRGB) ?? NSColor(self)
        var r: CGFloat = 0
        var g: CGFloat = 0
        var b: CGFloat = 0
        var a: CGFloat = 0
        nsColor.getRed(&r, green: &g, blue: &b, alpha: &a)
        #endif

        let ri = Int(round(r * 255))
        let gi = Int(round(g * 255))
        let bi = Int(round(b * 255))

        return String(format: "#%02x%02x%02x", ri, gi, bi)
    }
}
