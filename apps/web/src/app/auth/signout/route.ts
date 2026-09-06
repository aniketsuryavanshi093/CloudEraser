import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.set('next-auth.session-token', '', { expires: new Date(0), path: '/' });
  response.cookies.set('__Secure-next-auth.session-token', '', { expires: new Date(0), path: '/' });
  return response;
}
