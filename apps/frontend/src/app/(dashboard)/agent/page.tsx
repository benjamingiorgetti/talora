"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileText, Layers, Wrench, MessageSquare, Bell } from "lucide-react";
import { PromptEditorTab } from "@/components/agent/prompt-editor-tab";
import { SectionsTab } from "@/components/agent/sections-tab";
import { ToolsTab } from "@/components/agent/tools-tab";
import { ConversationsTab } from "@/components/agent/conversations-tab";
import { AlertsTab } from "@/components/agent/alerts-tab";

const sidebarItems = [
  { id: "prompt", label: "Prompt Editor", icon: FileText },
  { id: "sections", label: "Secciones", icon: Layers },
  { id: "tools", label: "Herramientas", icon: Wrench },
  { id: "conversations", label: "Conversaciones", icon: MessageSquare },
  { id: "alerts", label: "Alertas", icon: Bell },
] as const;

type TabId = (typeof sidebarItems)[number]["id"];

export default function AgentPage() {
  const [activeTab, setActiveTab] = useState<TabId>("prompt");

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="w-64 shrink-0">
        <h2 className="mb-5 text-xl font-extrabold">Configuracion del Agente</h2>
        <nav className="space-y-2">
          {sidebarItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-5 py-4 text-base font-semibold transition-all duration-200",
                  isActive
                    ? "bg-primary text-white shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <item.icon className="h-6 w-6" />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {activeTab === "prompt" && <PromptEditorTab />}
        {activeTab === "sections" && <SectionsTab />}
        {activeTab === "tools" && <ToolsTab />}
        {activeTab === "conversations" && <ConversationsTab />}
        {activeTab === "alerts" && <AlertsTab />}
      </div>
    </div>
  );
}
