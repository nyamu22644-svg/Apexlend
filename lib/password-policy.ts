export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_REQUIREMENTS = [
  { key: 'minimumLength', label: `At least ${MIN_PASSWORD_LENGTH} characters` },
  { key: 'lowercase', label: 'At least one lowercase letter (a-z)' },
  { key: 'uppercase', label: 'At least one uppercase letter (A-Z)' },
  { key: 'number', label: 'At least one number (0-9)' },
  { key: 'special', label: "At least one special character (!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~)" },
] as const;

export function getPasswordRequirementChecks(password: string) {
  return {
    minimumLength: password.length >= MIN_PASSWORD_LENGTH,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};'\\:\"|<>?,.\/`~]/.test(password),
  };
}

export function passwordMeetsRequirements(password: string) {
  return Object.values(getPasswordRequirementChecks(password)).every(Boolean);
}
