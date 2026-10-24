import crypto from 'node:crypto'

const KEY_SALT = 'stayserve-password-vault-v1'
let cachedKey

export const vaultEnabled = () => {
  const key = process.env.PASSWORD_VAULT_KEY || process.env.JWT_SECRET
  return Boolean(key && key.length >= 32)
}

const vaultSecret = () => {
  const key = process.env.PASSWORD_VAULT_KEY || process.env.JWT_SECRET
  return key && key.length >= 32 ? key : null
}

const vaultKey = () => {
  const secret = vaultSecret()
  if (!secret) return null
  cachedKey ||= crypto.scryptSync(secret, KEY_SALT, 32)
  return cachedKey
}

export function storePassword(user, password) {
  const key = vaultKey()
  if (!key) {
    console.warn('No vault key is configured; this password will not be viewable by support.')
    return
  }
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(String(password), 'utf8'), cipher.final()])
  // Vault payload format: base64(iv:authTag:ciphertext).
  user.passwordVault = [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64')).join(':')
}

export function revealPassword(user) {
  const key = vaultKey()
  if (!key || !user?.passwordVault) return null
  try {
    const [iv, authTag, encrypted] = user.passwordVault.split(':').map(part => Buffer.from(part, 'base64'))
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
