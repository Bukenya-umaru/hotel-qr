// Minimum password strength shared by every flow that sets a password:
// at least 8 characters with both letters and numbers.
export const isStrongPassword = password =>
  typeof password === 'string' && password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)

export const PASSWORD_RULE_MESSAGE = 'Passwords must be at least 8 characters and include both letters and numbers.'
