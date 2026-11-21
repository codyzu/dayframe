const enrollmentKey = 'dayframe.massage-welcome';

export function remembersMassageWelcome() {
  try {
    return localStorage.getItem(enrollmentKey) === 'enabled';
  } catch {
    return false;
  }
}

export function rememberEnrollment(isEnabled: boolean) {
  try {
    if (isEnabled) {
      localStorage.setItem(enrollmentKey, 'enabled');
    } else {
      localStorage.removeItem(enrollmentKey);
    }
  } catch {
    // The live page still protects its display if browser storage is unavailable.
  }
}
