import Foundation
import Observation
import FirebaseAuth
import FirebaseCore
import GoogleSignIn
import GoogleSignInSwift

@Observable
final class AuthService {
    var currentUser: User?
    private var authStateHandle: AuthStateDidChangeListenerHandle?

    var isAuthenticated: Bool {
        currentUser != nil
    }

    init() {
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.currentUser = user
        }
    }

    deinit {
        if let handle = authStateHandle {
            Auth.auth().removeStateDidChangeListener(handle)
        }
    }

    @MainActor
    func signInWithGoogle() async throws {
        guard let clientID = FirebaseApp.app()?.options.clientID else {
            throw AuthError.missingClientID
        }

        let config = GIDConfiguration(clientID: clientID)
        GIDSignIn.sharedInstance.configuration = config

        #if os(iOS)
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            throw AuthError.missingRootViewController
        }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)
        #else
        guard let window = NSApplication.shared.keyWindow else {
            throw AuthError.missingRootViewController
        }
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: window)
        #endif

        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.missingIDToken
        }

        let accessToken = result.user.accessToken.tokenString
        let credential = GoogleAuthProvider.credential(
            withIDToken: idToken,
            accessToken: accessToken
        )

        let authResult = try await Auth.auth().signIn(with: credential)
        currentUser = authResult.user
    }

    func signOut() {
        do {
            try Auth.auth().signOut()
            GIDSignIn.sharedInstance.signOut()
            currentUser = nil
        } catch {
            print("Error signing out: \(error.localizedDescription)")
        }
    }
}

enum AuthError: LocalizedError {
    case missingClientID
    case missingRootViewController
    case missingIDToken

    var errorDescription: String? {
        switch self {
        case .missingClientID:
            return "Firebase client ID not found. Check GoogleService-Info.plist."
        case .missingRootViewController:
            return "Unable to find root view controller for sign-in presentation."
        case .missingIDToken:
            return "Google Sign-In did not return an ID token."
        }
    }
}
