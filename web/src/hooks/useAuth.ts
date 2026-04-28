import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCustomToken,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const googleProvider = new GoogleAuthProvider();

// Demo/dev allowlist — must match the domain in firestore.rules isContractor().
const DEV_EMAIL_DOMAIN = '@ten99.local';

// Returns true if the user authenticated via Google Sign-In (contractor) or
// via password with an allowlisted dev email. Custom-token users (portal
// clients) have providerData from a custom provider.
export function isContractorUser(user: User): boolean {
  if (user.providerData.some((p) => p.providerId === 'google.com')) return true;
  const hasPassword = user.providerData.some((p) => p.providerId === 'password');
  return hasPassword && (user.email ?? '').endsWith(DEV_EMAIL_DOMAIN);
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChanged fires on sign-in, sign-out, and token refresh.
    // Returning the unsubscribe function ensures the listener is cleaned up
    // when the component unmounts or across hot-reload cycles.
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        setUser(firebaseUser);
        if (firebaseUser) {
          try {
            const tokenResult = await firebaseUser.getIdTokenResult();
            setClaims(tokenResult.claims as Record<string, unknown>);
          } catch {
            setClaims({});
          }
        } else {
          setClaims({});
        }
        setLoading(false);
      },
      (error) => {
        // Auth state errors (e.g. network failure retrieving token)
        console.error('Auth state error:', error);
        setUser(null);
        setClaims({});
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      // Popup blocked or third-party cookies disabled — fall back to redirect
      const code = (err as { code?: string }).code;
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        console.warn('Popup sign-in failed, falling back to redirect:', code);
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          console.error('Redirect sign-in error:', redirectErr);
        }
      }
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed.';
      console.error('Google sign-in error:', err);
      setAuthError(message);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    if (!email.endsWith(DEV_EMAIL_DOMAIN)) {
      const msg = `Dev sign-in is only available for ${DEV_EMAIL_DOMAIN} accounts.`;
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Email sign-in failed.';
      console.error('Email sign-in error:', err);
      setAuthError(message);
      throw err;
    }
  };

  const signInWithToken = async (token: string) => {
    setAuthError(null);
    try {
      await signInWithCustomToken(auth, token);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Token sign-in failed.';
      console.error('Custom token sign-in error:', err);
      setAuthError(message);
      throw err;
    }
  };

  const logout = async () => {
    setAuthError(null);
    await signOut(auth);
    setUser(null);
  };

  return {
    user,
    claims,
    loading,
    authError,
    signInWithGoogle,
    signInWithEmail,
    signInWithToken,
    logout,
  };
}
