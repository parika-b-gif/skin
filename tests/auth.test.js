import { describe, expect, it } from 'vitest'
import { createToken, hashPassword, readToken, verifyPassword } from '../server/auth.js'

const secret = 'test-jwt-secret'

 describe('authentication helpers', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toBe('correct horse battery staple')
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true)
    expect(await verifyPassword('wrong password', hash)).toBe(false)
  })

  it('creates and verifies role-bearing JWTs', () => {
    const token = createToken({ _id: 'user-1', email: 'user@example.com', role: 'user' }, secret)
    expect(readToken(token, secret)).toMatchObject({ sub: 'user-1', email: 'user@example.com', role: 'user' })
  })
})
