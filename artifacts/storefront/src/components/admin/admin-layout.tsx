import { useState, useEffect } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("dark");
    return () => { document.body.classList.remove("dark"); };
  }, []);

  return (
    <div className="dark flex h-screen overflow-hidden" style={{ background: "#0f1117", color: "#e2e8f0" }}>
      <aside className="hidden lg:flex lg:w-52 lg:flex-shrink-0">
        <AdminSidebar />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="w-52 p-0 border-0">
          <AdminSidebar onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <AdminTopbar onMenuClick={() => setDrawerOpen(true)} />
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4 bg-[#0f1117]">
          {children}
        </main>
      </div>
    </div>
  );
}
