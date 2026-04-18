import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Public routes — middleware does NOT enforce auth on these.
// `/api/generate-recipes` is listed as public so its own auth() check can
// return a proper 401 (middleware.auth.protect() would return 404 for API
// routes, which breaks client-side redirect-to-sign-in logic).
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/generate-recipes",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
