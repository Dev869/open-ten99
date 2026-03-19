import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  GoogleAuthProvider,
  signInWithCustomToken,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const googleProvider = new GoogleAuthProvider();

// Returns true if the user authenticated via Google Sign-In (contractor).
// Custom-token users (portal clients) have providerData from a custom provider.
export function isContractorUser(user: User): boolean {
  return user.providerData.some((p) => p.providerId === 'google.com');
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // onAuthStateChanged fires on sign-in, sign-out, and token refresh.
    // Returning the unsubscribe function ensures the listener is cleaned up
    // when the component unmounts or across hot-reload cycles.
    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
      },
      (error) => {
        // Auth state errors (e.g. network failure retrieving token)
        console.error('Auth state error:', error);
        setUser(null);
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
      const message =
        err instanceof Error ? err.message : 'Google sign-in failed.';
      // Don't expose raw Firebase error codes to the UI — log internally
      console.error('Google sign-in error:', err);
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
    // Eagerly clear user state so the UI responds immediately rather than
    // waiting for the onAuthStateChanged callback after signOut resolves.
    setUser(null);
    await signOut(auth);
  };

  return { user, loading, authError, signInWithGoogle, signInWithToken, logout };
}
