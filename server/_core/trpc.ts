import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const OWNER_EMAIL = "taherhhisam7@gmail.com";
const FULL_ACCESS_EMAILS = new Set([OWNER_EMAIL, "m.binzaqr@gmail.com"]);

/** Manager access is controlled on the server so every client follows one source of truth. */
export function hasFullAccessEmail(email: string | null | undefined): boolean {
  return !!email && FULL_ACCESS_EMAILS.has(email.trim().toLowerCase());
}

const requireOwner = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || ctx.user.email !== OWNER_EMAIL) {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const ownerProcedure = t.procedure.use(requireOwner);

const requireFullAccess = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user || !hasFullAccessEmail(ctx.user.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/** Read access to all manager dashboards, without owner-only maintenance actions. */
export const fullAccessProcedure = t.procedure.use(requireFullAccess);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
