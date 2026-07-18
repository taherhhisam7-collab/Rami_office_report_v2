import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

function getRedirectUri(req: Request): string {
  const configuredOrigin = process.env.OAUTH_SERVER_URL?.trim().replace(/\/+$/, "");

  if (configuredOrigin) {
    return `${configuredOrigin}/api/oauth/google/callback`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("OAUTH_SERVER_URL must be configured in production");
  }

  const origin = `${req.protocol}://${req.get("host")}`;
  return `${origin}/api/oauth/google/callback`;
}

export function registerGoogleOAuthRoutes(app: Express) {
  // Step 1: Redirect to Google
  app.get("/api/oauth/google/login", (req: Request, res: Response) => {
    if (!GOOGLE_CLIENT_ID) {
      const host = req.headers.host?.split(":")[0];
      if (process.env.NODE_ENV !== "production" && (host === "localhost" || host === "127.0.0.1")) {
        return res.redirect("/records");
      }
      return res.status(503).send("Google OAuth is not configured");
    }

    const redirectUri = getRedirectUri(req);
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  // Step 2: Handle Google callback
  app.get("/api/oauth/google/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : null;
    const error = typeof req.query.error === "string" ? req.query.error : null;

    if (error || !code) {
      console.error("[Google OAuth] Error:", error || "No code");
      return res.redirect("/?error=oauth_failed");
    }

    try {
      const redirectUri = getRedirectUri(req);

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("[Google OAuth] Token exchange failed:", errBody);
        return res.redirect("/?error=token_exchange_failed");
      }

      const tokenData = await tokenRes.json() as { access_token: string; id_token?: string };

      // Get user info from Google
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userInfoRes.ok) {
        console.error("[Google OAuth] Failed to get user info");
        return res.redirect("/?error=userinfo_failed");
      }

      const googleUser = await userInfoRes.json() as {
        sub: string;
        name?: string;
        email?: string;
        picture?: string;
      };

      const openId = `google_${googleUser.sub}`;
      const name = googleUser.name || googleUser.email || "مستخدم";
      const email = googleUser.email || null;

      // تحديد الدور: admin فقط لـ taherhhisam7@gmail.com، وإلا user عادي
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "taherhhisam7@gmail.com";
      const role: "admin" | "user" = email === ADMIN_EMAIL ? "admin" : "user";

      // Upsert user in DB
      await db.upsertUser({
        openId,
        name,
        email,
        role,
        loginMethod: "google",
        lastSignedIn: new Date(),
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      console.info("[Google OAuth] Setting session cookie", {
        host: req.get("host"),
        protocol: req.protocol,
        forwardedProto: req.headers["x-forwarded-proto"],
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
      });
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      return res.redirect(302, "/");
    } catch (err) {
      console.error("[Google OAuth] Callback error:", err);
      return res.redirect("/?error=oauth_error");
    }
  });
}
