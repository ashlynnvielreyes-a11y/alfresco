/**
 * Common validation utilities used across the application
 */

export const validators = {
  // Email validation
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  // Username validation
  username: (username: string): boolean => {
    return username && username.trim().length > 0
  },

  // Password validation helpers
  passwordLength: (password: string): boolean => password.length >= 8 && password.length <= 30,
  hasLowercase: (password: string): boolean => /[a-z]/.test(password),
  hasUppercase: (password: string): boolean => /[A-Z]/.test(password),
  hasNumber: (password: string): boolean => /\d/.test(password),
  hasSpecialChar: (password: string): boolean => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),

  // Number validation
  isPositive: (value: number): boolean => value > 0,
  isInteger: (value: number): boolean => Number.isInteger(value),

  // String validation
  isEmpty: (value: string): boolean => !value || value.trim().length === 0,
  minLength: (value: string, min: number): boolean => value.length >= min,
  maxLength: (value: string, max: number): boolean => value.length <= max,
}

export const errorMessages = {
  REQUIRED_FIELD: "This field is required",
  INVALID_EMAIL: "Invalid email address",
  INVALID_USERNAME: "Username is required",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters",
  PASSWORD_TOO_LONG: "Password must not exceed 30 characters",
  PASSWORD_NEEDS_LOWERCASE: "Password must contain lowercase letters",
  PASSWORD_NEEDS_UPPERCASE: "Password must contain uppercase letters",
  PASSWORD_NEEDS_NUMBER: "Password must contain a number",
  PASSWORD_NEEDS_SPECIAL: "Password must contain a special character",
  PASSWORD_MISMATCH: "Passwords do not match",
  PASSWORD_FORBIDDEN_SEQUENCE: "Password contains forbidden sequences",
  USER_EXISTS: "Username already exists",
}
