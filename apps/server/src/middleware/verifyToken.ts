import { jwtDecrypt, type JWTPayload } from 'jose';

export interface AuthenticatedToken extends JWTPayload {
  sub: string;
  email?: string;
}

/**
 * Decrypts and validates the encrypted JWT issued by NextAuth/Auth.js.
 * The Socket.IO client must send this token in handshake.auth.token.
 */
export async function verifyToken(token: string): Promise<AuthenticatedToken> {
  if (!token) throw new Error('No token provided');
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('NEXTAUTH_SECRET is not configured');

  const { payload } = await jwtDecrypt(
    token,
    new TextEncoder().encode(secret),
    { clockTolerance: 15 },
  );

  if (!payload.sub) throw new Error('Invalid token: missing subject');
  return payload as AuthenticatedToken;
}
