import SwiftUI

struct LoginView: View {
    @Environment(AuthService.self) private var authService
    @Environment(ThemeManager.self) private var theme
    @State private var isSigningIn = false

    private let gradientStart = Color(red: 0.486, green: 0.227, blue: 0.929) // #7c3aed
    private let gradientEnd = Color(red: 0.659, green: 0.333, blue: 0.969)   // #a855f7

    var body: some View {
        GeometryReader { geometry in
            VStack(spacing: 0) {
                // MARK: - Purple gradient top section
                ZStack {
                    LinearGradient(
                        colors: [gradientStart, gradientEnd],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                    .ignoresSafeArea(edges: .top)

                    VStack(spacing: 12) {
                        Spacer()

                        Image(systemName: "doc.text.fill")
                            .font(.system(size: 48))
                            .foregroundStyle(.white.opacity(0.9))

                        Text("openchanges")
                            .font(.system(size: 36, weight: .bold, design: .rounded))
                            .foregroundStyle(.white)

                        Text("Client work, organized.")
                            .font(.title3)
                            .foregroundStyle(.white.opacity(0.85))

                        Spacer()
                    }
                    .padding()
                }
                .frame(height: geometry.size.height * 0.5)

                // MARK: - White bottom section
                ZStack {
                    Color.white
                        .ignoresSafeArea(edges: .bottom)

                    VStack(spacing: 24) {
                        Spacer()

                        Text("Welcome back")
                            .font(.title2)
                            .fontWeight(.semibold)
                            .foregroundStyle(.primary)

                        Text("Sign in to manage your change orders, clients, and invoices.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)

                        // Google Sign-In button
                        Button {
                            Task {
                                isSigningIn = true
                                do {
                                    try await authService.signInWithGoogle()
                                } catch {
                                    print("Sign-in error: \(error.localizedDescription)")
                                }
                                isSigningIn = false
                            }
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: "g.circle.fill")
                                    .font(.title3)
                                    .foregroundStyle(.primary)

                                Text("Continue with Google")
                                    .font(.body)
                                    .fontWeight(.medium)
                                    .foregroundStyle(.primary)
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                            .background(
                                RoundedRectangle(cornerRadius: 14)
                                    .fill(Color.white)
                                    .shadow(color: .black.opacity(0.08), radius: 8, y: 2)
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .strokeBorder(Color.gray.opacity(0.2), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .disabled(isSigningIn)
                        .opacity(isSigningIn ? 0.6 : 1)
                        .padding(.horizontal, 40)

                        if isSigningIn {
                            ProgressView()
                                .tint(gradientStart)
                        }

                        Spacer()

                        Text("By signing in, you agree to our Terms of Service and Privacy Policy.")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 48)
                            .padding(.bottom, 16)
                    }
                }
                .frame(height: geometry.size.height * 0.5)
            }
        }
    }
}

#Preview {
    LoginView()
}
