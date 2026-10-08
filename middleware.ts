import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = [
    "/diagnostic",
    "/map",
    "/activity",
    "/progress",
    "/history",
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  if (!isProtected) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2])
        );
      },
    },
  });

  let hasAuthUser = false;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      hasAuthUser = true;
    }
  } catch {
    hasAuthUser = false;
  }

  const isTestOrDev =
    process.env.NODE_ENV === "test" ||
    process.env.ALLOW_TEST_USER_HEADER === "true" ||
    process.env.NODE_ENV !== "production";

  if (!hasAuthUser && !(isTestOrDev && request.headers.get("x-user-id"))) {
    const redirectUrl = new URL("/auth", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/diagnostic/:path*",
    "/map/:path*",
    "/activity/:path*",
    "/progress/:path*",
    "/history/:path*",
  ],
};
