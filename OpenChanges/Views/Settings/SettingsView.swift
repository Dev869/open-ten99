import SwiftUI
import FirebaseAuth

struct SettingsView: View {
    @Environment(AuthService.self) private var authService
    @Environment(SettingsService.self) private var settingsService
    @Environment(ThemeManager.self) private var theme
    @State private var hourlyRateText = ""
    @State private var companyName = ""
    @State private var showSignOutAlert = false

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929)
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.96, green: 0.95, blue: 0.98)
                    .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 20) {
                        appearanceSection
                        billingSection
                        companySection
                        accountSection
                    }
                    .padding()
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                hourlyRateText = String(format: "%.0f", settingsService.settings.hourlyRate)
                companyName = settingsService.settings.companyName
            }
            .alert("Sign Out?", isPresented: $showSignOutAlert) {
                Button("Sign Out", role: .destructive) {
                    authService.signOut()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("You will need to sign in again to access your data.")
            }
        }
    }

    // MARK: - Appearance Section

    private var appearanceSection: some View {
        settingsCard(title: "Appearance") {
            VStack(alignment: .leading, spacing: 14) {
                Text("Accent Color")
                    .font(.subheadline)
                    .fontWeight(.medium)

                // Color swatches
                HStack(spacing: 14) {
                    ForEach(ThemeManager.availableColors) { option in
                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                theme.updateAccentColor(from: option.hex)
                                settingsService.settings.accentColor = option.hex
                            }
                            saveSettings()
                        } label: {
                            ZStack {
                                Circle()
                                    .fill(
                                        LinearGradient(
                                            colors: [option.color, option.color.opacity(0.7)],
                                            startPoint: .topLeading,
                                            endPoint: .bottomTrailing
                                        )
                                    )
                                    .frame(width: 40, height: 40)
                                    .shadow(color: option.color.opacity(0.3), radius: 4, y: 2)

                                if settingsService.settings.accentColor == option.hex {
                                    Image(systemName: "checkmark")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                        .foregroundStyle(.white)
                                }
                            }
                        }
                        .buttonStyle(.plain)
                    }
                }

                Divider()

                // Preview
                VStack(alignment: .leading, spacing: 8) {
                    Text("Preview")
                        .font(.caption)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 12) {
                        RoundedRectangle(cornerRadius: 8)
                            .fill(
                                LinearGradient(
                                    colors: [theme.accentColor, theme.accentColor.opacity(0.7)],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(height: 36)
                            .overlay(
                                Text("Approve")
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.white)
                            )

                        Text("In Review")
                            .font(.caption)
                            .fontWeight(.medium)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(
                                Capsule()
                                    .fill(theme.accentColor.opacity(0.12))
                            )
                            .foregroundStyle(theme.accentColor)

                        Circle()
                            .fill(theme.accentColor)
                            .frame(width: 10, height: 10)

                        Spacer()
                    }
                }
            }
        }
    }

    // MARK: - Billing Section

    private var billingSection: some View {
        settingsCard(title: "Billing") {
            VStack(alignment: .leading, spacing: 8) {
                Text("Hourly Rate")
                    .font(.subheadline)
                    .fontWeight(.medium)

                HStack(spacing: 6) {
                    Text("$")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)

                    TextField("0", text: $hourlyRateText)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .textFieldStyle(.plain)
                        #if os(iOS)
                        .keyboardType(.decimalPad)
                        #endif
                        .onChange(of: hourlyRateText) {
                            if let rate = Double(hourlyRateText) {
                                settingsService.settings.hourlyRate = rate
                                saveSettings()
                            }
                        }

                    Text("/ hour")
                        .font(.subheadline)
                        .foregroundStyle(.tertiary)
                }
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(red: 0.96, green: 0.95, blue: 0.98))
                )
            }
        }
    }

    // MARK: - Company Section

    private var companySection: some View {
        settingsCard(title: "Company") {
            VStack(alignment: .leading, spacing: 8) {
                Text("Company Name")
                    .font(.subheadline)
                    .fontWeight(.medium)

                TextField("Your company name", text: $companyName)
                    .font(.subheadline)
                    .textFieldStyle(.plain)
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color(red: 0.96, green: 0.95, blue: 0.98))
                    )
                    .onChange(of: companyName) {
                        settingsService.settings.companyName = companyName
                        saveSettings()
                    }
            }
        }
    }

    // MARK: - Account Section

    private var accountSection: some View {
        settingsCard(title: "Account") {
            VStack(spacing: 14) {
                if let user = authService.currentUser {
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [gradientStart.opacity(0.6), gradientEnd.opacity(0.6)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 40, height: 40)

                            Image(systemName: "person.fill")
                                .font(.subheadline)
                                .foregroundStyle(.white)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text("Signed in as")
                                .font(.caption)
                                .foregroundStyle(.secondary)

                            Text(user.email ?? "Unknown")
                                .font(.subheadline)
                                .fontWeight(.medium)
                        }

                        Spacer()
                    }
                }

                Divider()

                Button {
                    showSignOutAlert = true
                } label: {
                    HStack {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                        Text("Sign Out")
                    }
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(Color.red.opacity(0.06))
                    )
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Shared Card

    private func settingsCard(title: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title.uppercased())
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .padding(.horizontal, 4)

            VStack(alignment: .leading) {
                content()
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16)
                    .fill(Color.white)
                    .shadow(color: .black.opacity(0.04), radius: 6, y: 2)
            )
        }
    }

    // MARK: - Helpers

    private func saveSettings() {
        Task {
            try? await settingsService.saveSettings()
        }
    }

}

#Preview {
    SettingsView()
}
