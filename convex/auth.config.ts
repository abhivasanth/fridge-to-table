export default {
  providers: [
    {
      // Set CLERK_JWT_ISSUER_DOMAIN in Convex dashboard → Settings → Environment Variables
      // Value: your Clerk instance URL (e.g. "https://your-app.clerk.accounts.dev")
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
};
