/**
 * Two-step verification is recommended, not enforced — there is no deadline and
 * no lock-out, so nothing gates the app. This stays as a pass-through so
 * ProtectedRoute doesn't need to change; the reminder lives in TwoFactorBanner.
 */
export default function TwoFactorGate({ children }) {
  return children;
}
