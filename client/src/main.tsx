import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";

declare global {
  interface Window {
    __APP_BOOTED__?: boolean;
  }
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    // Remove workers/caches from older deployments before registering the
    // current worker. This prevents a stale PWA shell from hiding new builds.
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      await Promise.all(registrations.map(registration => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      await navigator.serviceWorker.register(`/sw.js?v=${Date.now()}`);
    }).catch(() => {
      // Installation prompt remains available where the browser supports it.
    });
  });
}

// A user who leaves the app open receives a newly deployed build automatically.
// This avoids asking anyone to hard-refresh after a Render deployment.
async function reloadWhenNewBuildIsAvailable() {
  if (!import.meta.env.PROD) return;
  // Do not reload before the app has fully booted — avoids reload loops on
  // slow connections (e.g. iPhone Chrome on mobile data).
  if (!window.__APP_BOOTED__) return;

  try {
    const response = await fetch("/", { cache: "no-store" });
    if (!response.ok) return;

    const html = await response.text();
    const latestBundle = html.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i)?.[1];
    const activeBundle = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src;

    if (
      latestBundle &&
      activeBundle &&
      new URL(latestBundle, window.location.origin).pathname !== new URL(activeBundle).pathname
    ) {
      window.location.reload();
    }
  } catch {
    // Keep the current screen usable if a transient network request fails.
  }
}

if (import.meta.env.PROD) {
  window.setTimeout(() => void reloadWhenNewBuildIsAvailable(), 15_000);
  window.setInterval(() => void reloadWhenNewBuildIsAvailable(), 5 * 60_000);
}
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        // Preview auto-login fallback: when the browser blocks iframe cookies
        // (Safari ITP / private browsing / WebView), the runtime mirrors the
        // session into sessionStorage so we can forward it as a Bearer token.
        // The regular OAuth cookie flow keeps working and takes priority server-side.
        try {
          const raw = sessionStorage.getItem("manus-cookie");
          if (raw) {
            const prefix = `${COOKIE_NAME}=`;
            const pair = raw.split(";").find(s => s.trim().startsWith(prefix));
            const token = pair?.trim().slice(prefix.length);
            if (token) {
              return { Authorization: `Bearer ${token}` };
            }
          }
        } catch {
          // sessionStorage unavailable
        }
        return {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
