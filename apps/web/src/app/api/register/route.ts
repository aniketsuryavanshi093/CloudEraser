import { NextResponse } from 'next/server';
import { createPasswordHash } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.toLowerCase().trim();
  const password = body?.password ?? '';
  if (!email || password.length < 8) {
    return NextResponse.json({ error: 'Email and a password of at least 8 characters are required.' }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  const user = await prisma.user.create({
    data: { email, passwordHash: await createPasswordHash(password) },
    select: { id: true },
  });
  return NextResponse.json({ id: user.id }, { status: 201 });
}
