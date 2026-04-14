import bcrypt from 'bcryptjs'

const BCRYPT_PREFIX = '$2'

export const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, 10)
}

export const verifyPassword = async (plainPassword, storedPasswordHash) => {
  if (!plainPassword || !storedPasswordHash) {
    return false
  }

  // Support both bcrypt hashes and legacy plain-text mock passwords.
  if (storedPasswordHash.startsWith(BCRYPT_PREFIX)) {
    return bcrypt.compare(plainPassword, storedPasswordHash)
  }

  return plainPassword === storedPasswordHash
}
