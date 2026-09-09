import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function createToken(user, secret) {
  return jwt.sign({ sub: user._id.toString(), email: user.email, role: user.role }, secret, { expiresIn: '7d' })
}

export function readToken(token, secret) {
  return jwt.verify(token, secret)
}
