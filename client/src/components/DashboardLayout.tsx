import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { BarChart3, FileText, GitCompareArrows, LayoutDashboard, LogOut, PanelRight, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const OWNER_EMAIL = "taherhhisam7@gmail.com";

const adminMenuItems = [
  { icon: LayoutDashboard, label: "لوحة التحكم", path: "/" },
  { icon: FileText, label: "السجلات", path: "/records" },
  { icon: GitCompareArrows, label: "مقارنة الفروع", path: "/branch-comparison" },
  { icon: TrendingUp, label: "تقرير النمو", path: "/growth-report" },
];

const userMenuItems = [
  { icon: FileText, label: "السجلات", path: "/records" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <LayoutDashboard className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-center text-foreground">
              نظام إدارة سندات القبض
            </h1>
            <p className="text-sm text-muted-foreground text-center">
              يرجى تسجيل الدخول للوصول إلى لوحة التحكم
            </p>
          </div>
          <Button
            onClick={() => { window.location.href = getLoginUrl(); }}
            size="lg"
            className="w-full"
          >
            تسجيل الدخول
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const syncMonthMutation = trpc.sheets.syncMonth.useMutation({
    onSuccess: async result => {
      await utils.sheets.invalidate();
      toast.success(`Synced ${result.imported} receipts for ${result.monthYear}`);
    },
    onError: () => toast.error("Current-month sync failed"),
  });
  const importHistoryMutation = trpc.sheets.importHistory.useMutation({
    onSuccess: async result => {
      await utils.sheets.invalidate();
      toast.success(`Imported ${result.imported} historical receipts`);
    },
    onError: () => toast.error("Historical import failed"),
  });
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isAdmin = user?.role === "admin";
  const isOwner = user?.email === OWNER_EMAIL;
  const baseMenuItems = isAdmin ? adminMenuItems : userMenuItems;
  const menuItems = isOwner
    ? [...baseMenuItems, { icon: Wallet, label: "عمولات الموظفين", path: "/commissions" }]
    : baseMenuItems;
  const activeMenuItem = menuItems.find((item) => item.path === location);

  const clearCacheMutation = trpc.sheets.clearCache.useMutation({
    onSuccess: () => toast.success("تم تحديث البيانات من جداول Google Sheets"),
    onError: () => toast.error("فشل في تحديث البيانات"),
  });

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      // RTL: sidebar is on the right
      const sidebarRight = sidebarRef.current?.getBoundingClientRect().right ?? 0;
      const newWidth = sidebarRight - e.clientX;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-l-0 border-r-0" side="right" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-3 w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
                aria-label="تبديل الشريط الجانبي"
              >
                <PanelRight className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-sidebar-foreground text-sm truncate">
                    سندات القبض
                  </span>
                  <span className="text-xs text-sidebar-foreground/50 truncate">
                    نظام إدارة الفروع
                  </span>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 py-3">
            <SidebarMenu className="px-2">
              {menuItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className="h-10 font-medium"
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/60"}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* زر تحديث البيانات - للادمن فقط */}
            {isAdmin && !isCollapsed && (
              <div className="px-3 mt-4">
                <button
                  onClick={() => syncMonthMutation.mutate({})}
                  disabled={syncMonthMutation.isPending || importHistoryMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncMonthMutation.isPending ? "animate-spin" : ""}`} />
                  <span>مزامنة الشهر الحالي</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm("سيتم استيراد الأرشيف التاريخي مرة واحدة وقد يستغرق عدة دقائق. هل تريد المتابعة؟")) {
                      importHistoryMutation.mutate();
                    }
                  }}
                  disabled={syncMonthMutation.isPending || importHistoryMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <FileText className={`h-3.5 w-3.5 ${importHistoryMutation.isPending ? "animate-spin" : ""}`} />
                  <span>استيراد الأرشيف مرة واحدة</span>
                </button>
                <button
                  onClick={() => clearCacheMutation.mutate()}
                  disabled={clearCacheMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${clearCacheMutation.isPending ? "animate-spin" : ""}`} />
                  <span>تحديث البيانات</span>
                </button>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-right focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs font-bold bg-sidebar-primary text-sidebar-primary-foreground">
                      {user?.name?.charAt(0)?.toUpperCase() ?? "م"}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-sidebar-foreground truncate leading-none">
                        {user?.name ?? "المستخدم"}
                      </p>
                      <p className="text-xs text-sidebar-foreground/50 truncate mt-1">
                        {user?.email ?? user?.name ?? ""}
                      </p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="ml-2 h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {/* مقبض تغيير حجم الشريط الجانبي */}
        <div
          className={`absolute top-0 left-0 w-1 h-full cursor-col-resize hover:bg-primary/20 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => { if (!isCollapsed) setIsResizing(true); }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg" />
              <span className="font-semibold text-foreground">
                {activeMenuItem?.label ?? "القائمة"}
              </span>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
