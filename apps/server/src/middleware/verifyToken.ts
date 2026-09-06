import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '../lib/supabase';

/**
 * Validates a Supabase JWT using the service-role client.
 *
 * The service-role client calls Supabase's `/auth/v1/user` endpoint which
 * verifies the JWT signature server-side — no local secret required.
 *
 * @param token - The raw JWT from the Socket.IO handshake `auth` payload.
 * @returns The authenticated Supabase `User` object.
 * @throws If the token is missing, malformed, or expired.
 */
export async function verifyToken(token: string): Promise<User> {
  if (!token) {
    throw new Error('No token provided');
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new Error(error?.message ?? 'Invalid or expired token');
  }

  return data.user;
}
