import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const host = opts.req.headers.host?.split(":")[0];
  const isLocalPreview =
    process.env.NODE_ENV !== "production" &&
    (process.env.DEV_PREVIEW_ADMIN === "true" || host === "localhost" || host === "127.0.0.1");

  if (isLocalPreview) {
    user = {
      id: 0,
      openId: "local-preview-admin",
      name: "معاينة المدير",
      email: "preview@example.com",
      loginMethod: "local-preview",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  } else {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
