import { initializeApp, FirebaseError } from 'firebase/app'
import {
  getAuth,
  browserLocalPersistence,
  setPersistence,
  GithubAuthProvider,
  EmailAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  getAdditionalUserInfo,
  type UserCredential,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env['VITE_FIREBASE_API_KEY'],
  authDomain: import.meta.env['VITE_FIREBASE_AUTH_DOMAIN'],
  projectId: import.meta.env['VITE_FIREBASE_PROJECT_ID'],
  storageBucket: import.meta.env['VITE_FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: import.meta.env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
  appId: import.meta.env['VITE_FIREBASE_APP_ID'],
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)

// FR27: Persist sessions across browser sessions
void setPersistence(auth, browserLocalPersistence)

const githubProvider = new GithubAuthProvider()
const emailProvider = new EmailAuthProvider()

async function signInWithEmail(email: string, password: string): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password)
}

async function signUpWithEmail(email: string, password: string): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password)
}

async function signInWithGithub(): Promise<{ credential: UserCredential; isNewUser: boolean }> {
  const credential = await signInWithPopup(auth, githubProvider)
  const isNewUser = getAdditionalUserInfo(credential)?.isNewUser ?? true
  return { credential, isNewUser }
}

async function signOut(): Promise<void> {
  return firebaseSignOut(auth)
}

function mapFirebaseError(error: unknown): string | null {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Incorrect email or password. Try again.'
      case 'auth/email-already-in-use':
        return 'An account with this email already exists. Try signing in.'
      case 'auth/weak-password':
        return 'Password is too weak. Use at least 6 characters.'
      case 'auth/invalid-email':
        return 'Please enter a valid email address.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please try again later.'
      case 'auth/popup-blocked':
        return 'Popup was blocked. Please allow popups for this site and try again.'
      case 'auth/popup-closed-by-user':
        return null
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.'
      default:
        return 'Something went wrong. Try again.'
    }
  }
  return 'Something went wrong. Try again.'
}

export { auth, githubProvider, emailProvider, signInWithEmail, signUpWithEmail, signInWithGithub, signOut, mapFirebaseError }
