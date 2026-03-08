"use client";

import { useState, Suspense } from "react";
import { cn } from "@/lib/utils";
import { FileText, Wrench, MessageSquare, Bell, Calendar } from "lucide-react";
import { PromptEditorTab } from "@/components/agent/prompt-editor-tab";
import { ToolsTab } from "@/components/agent/tools-tab";
import { ConversationsTab } from "@/components/agent/conversations-tab";
import { AlertsTab } from "@/components/agent/alerts-tab";
import { CalendarTab } from "@/components/agent/calendar-tab";
import { AnimatePresence, motion } from "framer-motion";
import { fadeIn, spring } from "@/lib/motion";

const sidebarItems = [
  { id: "prompt", label: "Prompt Editor", icon: FileText },
  { id: "tools", label: "Herramientas", icon: Wrench },
  { id: "conversations", label: "Conversaciones", icon: MessageSquare },
  { id: "alerts", label: "Alertas", icon: Bell },
  { id: "calendar", label: "Google Calendar", icon: Calendar },
] as const;

type TabId = (typeof sidebarItems)[number]["id"];

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState<TabId>("prompt");

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 sticky top-24 self-start">
        <div className="bg-card border border-border rounded-lg p-3">
          <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configuracion
          </h2>
          <nav className="space-y-0.5">
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "relative flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors duration-150",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground font-normal"
                  )}
                >
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-indicator"
                      className="absolute inset-0 rounded-md bg-accent"
                      transition={spring.indicator}
                      style={{ zIndex: -1 }}
                    />
                  )}
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {activeTab === "prompt" && <PromptEditorTab />}
            {activeTab === "tools" && <ToolsTab />}
            {activeTab === "conversations" && <ConversationsTab />}
            {activeTab === "alerts" && <AlertsTab />}
            {activeTab === "calendar" && (
              <Suspense fallback={null}>
                <CalendarTab />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
