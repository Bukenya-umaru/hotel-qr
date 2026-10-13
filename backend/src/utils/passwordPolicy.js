// Minimum password strength shared by every flow that sets a password:
// easy to remember but mixed — at least 6 characters with both letters and numbers.
export const isStrongPassword = password =>
  typeof password === 'string' && password.length >= 6 && /[a-zA-Z]/.test(password) && /\d/.test(password)

export const PASSWORD_RULE_MESSAGE = 'Passwords must be at least 6 characters and include both letters and numbers.'
