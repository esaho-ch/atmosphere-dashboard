import { cookies } from "next/headers";
import { verifySession } from "@/lib/session";
import AppSidebar from "@/components/AppSidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.toString());

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-slate-50">
        <AppSidebar userName={session?.name} />
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </TooltipProvider>
  );
}
