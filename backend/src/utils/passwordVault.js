import crypto from 'node:crypto'

// Passwords are bcrypt-hashed for sign-in verification. Additionally, an
// AES-256-GCM encrypted copy is kept so the developer support dashboard can
// reveal the actual password of a business owner or chef account for a short
// viewing window. The key never leaves the server.
const KEY_SALT = 'stayserve-password-vault-v1'
let cachedKey

export const vaultEnabled = () =>
  Boolean(process.env.PASSWORD_VAULT_KEY && process.env.PASSWORD_VAULT_KEY.length >= 32)

const vaultKey = () => {
  if (!vaultEnabled()) return null
  cachedKey ||= crypto.scryptSync(process.env.PASSWORD_VAULT_KEY, KEY_SALT, 32)
  return cachedKey
}

export function storePassword(user, password) {
  const key = vaultKey()
  if (!key) {
    console.warn('PASSWORD_VAULT_KEY is not configured; this password will not be viewable by support.')
    return
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(password), 'utf8'), cipher.final()])
  user.passwordVault = [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join(':')
}

export function revealPassword(user) {
  const key = vaultKey()
  if (!key || !user?.passwordVault) return null
  const [iv, authTag, encrypted] = user.passwordVault.split(':').map(part => Buffer.from(part, 'base64'))
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}
