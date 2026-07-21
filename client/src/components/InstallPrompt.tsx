import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "branchmgr-install-prompt-dismissed";

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;
    setMobile(isMobileDevice());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS Safari and some desktop browsers do not expose beforeinstallprompt.
    // Only show the fallback prompt if the user is already authenticated
    // (i.e. the app has fully booted) to avoid blocking the login screen.
    const timer = window.setTimeout(() => {
      if (window.__APP_BOOTED__) {
        setVisible(true);
      }
    }, 3000);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border border-primary/20 bg-background p-4 shadow-2xl" dir="rtl">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-xl text-primary-foreground">⬇</div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-foreground">ثبّت التطبيق للوصول السريع</h2>
          {installEvent ? (
            <p className="mt-1 text-sm text-muted-foreground">أضف نظام سندات القبض إلى جهازك ليظهر مثل أي تطبيق.</p>
          ) : mobile ? (
            <p className="mt-1 text-sm text-muted-foreground">من قائمة المتصفح اختر «إضافة إلى الشاشة الرئيسية».</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</p>
          )}
        </div>
        <button onClick={dismiss} className="text-xl leading-none text-muted-foreground" aria-label="إغلاق">×</button>
      </div>
      {installEvent && (
        <button onClick={install} className="mt-3 w-full rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">تثبيت الآن</button>
      )}
    </div>
  );
}
