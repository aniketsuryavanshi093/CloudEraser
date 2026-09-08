import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { authOptions } from "@/lib/auth";

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId)
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret)
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );

  const token = await new SignJWT({ email: session.user.email ?? undefined })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token });
}
