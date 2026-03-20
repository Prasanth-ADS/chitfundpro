import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { ChatAssistant } from "../ChatAssistant";

export function Layout() {
  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      <Sidebar />
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-4 flex-1">
        <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8">
          <Outlet />
        </main>
      </div>
      <ChatAssistant />
    </div>
  );
}
