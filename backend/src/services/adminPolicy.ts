/** Password rule for the single administrator account (checked by the seed script). */
export function adminPasswordProblem(password: string): string | null {
  if (password.length < 12) return 'ADMIN_PASSWORD must be at least 12 characters long.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'ADMIN_PASSWORD must contain at least one letter and one number.';
  return null;
}
