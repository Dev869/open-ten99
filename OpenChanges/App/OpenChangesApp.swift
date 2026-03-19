import SwiftUI
import FirebaseCore
import GoogleSignIn

@main
struct OpenChangesApp: App {
    @State private var authService = AuthService()
    @State private var firestoreService = FirestoreService()
    @State private var settingsService = SettingsService()
    @State private var themeManager = ThemeManager.shared

    init() {
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            Group {
                if authService.isAuthenticated {
                    MainTabView()
                } else {
                    LoginView()
                }
            }
            .environment(authService)
            .environment(firestoreService)
            .environment(settingsService)
            .environment(themeManager)
            .tint(themeManager.accentColor)
            .onOpenURL { url in
                GIDSignIn.sharedInstance.handle(url)
            }
            .task {
                await settingsService.loadSettings()
                themeManager.updateAccentColor(from: settingsService.settings.accentColor)
            }
            .onChange(of: settingsService.settings.accentColor) { _, newValue in
                themeManager.updateAccentColor(from: newValue)
            }
        }
    }
}
