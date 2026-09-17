import { NextResponse, type NextRequest } from 'next/server';

/**
 * Sessiya cookie'si bo'lmasa — kirish sahifasiga.
 *
 * To'liq tekshiruv (imzо va `ADMIN_UIDS`) server komponentida
 * `currentUser()` orqali bajariladi: Admin SDK edge muhitida ishlamaydi,
 * shuning uchun middleware faqat arzon "cookie bormi?" tekshiruvini
 * qiladi va ochiq sahifa qoldirmaydi.
 */
export function middleware(request: NextRequest): NextResponse {
  const hasSession = request.cookies.has('byudjet_session');
  const { pathname } = request.nextUrl;

  if (!hasSession && pathname !== '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Cron endpointlari `CRON_SECRET` bilan himoyalangan — ular middleware'dan
    // o'tkazilmaydi.
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
