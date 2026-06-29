"use client";

import React, { useState } from "react";

const STATUS_STYLES: Record<string, string> = {
  kandydat: "bg-green-100 text-green-700 border-green-200",
  inspiracja: "bg-blue-100 text-blue-700 border-blue-200",
  eksperyment: "bg-orange-100 text-orange-700 border-orange-200",
  "raczej nie": "bg-red-100 text-red-400 border-red-200",
};

const TECH_STYLES: Record<string, string> = {
  roughjs: "bg-violet-100 text-violet-700",
  "rough-notation": "bg-pink-100 text-pink-700",
  "perfect-freehand": "bg-teal-100 text-teal-700",
  "wired-elements": "bg-amber-100 text-amber-700",
  "custom SVG": "bg-cyan-100 text-cyan-700",
  "CSS/SVG": "bg-neutral-100 text-neutral-600",
  "Google Fonts": "bg-indigo-100 text-indigo-700",
};

interface DemoBoxProps {
  id?: string;
  title: string;
  status?: string;
  tech?: string;
  description?: string;
  useCase?: string;
  children: React.ReactNode;
  controls?: React.ReactNode;
  code?: string;
  fullWidth?: boolean;
}

export function DemoBox({
  id,
  title,
  status,
  tech,
  description,
  useCase,
  children,
  controls,
  code,
  fullWidth = false,
}: DemoBoxProps) {
  const [showCode, setShowCode] = useState(false);

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 bg-neutral-50/80">
        <div className="flex items-center gap-2 flex-wrap">
          {id && (
            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded">
              {id}
            </span>
          )}
          <span className="text-sm font-semibold text-neutral-800">{title}</span>
          {status && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_STYLES[status] || "bg-neutral-100 text-neutral-500 border-neutral-200"}`}
            >
              {status}
            </span>
          )}
          {tech && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${TECH_STYLES[tech] || "bg-neutral-100 text-neutral-500"}`}>
              {tech}
            </span>
          )}
        </div>
        {code && (
          <button
            onClick={() => setShowCode(!showCode)}
            className="text-[10px] font-mono text-neutral-400 hover:text-neutral-700 transition-colors px-2 py-1 border border-neutral-200 rounded hover:bg-white"
          >
            {showCode ? "ukryj" : "</> kod"}
          </button>
        )}
      </div>

      <div className={`flex ${fullWidth ? "flex-col" : "flex-row"}`}>
        <div
          className={`flex items-center justify-center p-6 min-h-[120px] ${controls && !fullWidth ? "flex-1" : "w-full"}`}
          style={{ background: "repeating-linear-gradient(45deg,transparent,transparent 10px,rgba(0,0,0,.015) 10px,rgba(0,0,0,.015) 11px)" }}
        >
          {children}
        </div>
        {controls && (
          <div className={`border-neutral-100 bg-neutral-50/60 p-4 space-y-3 ${fullWidth ? "border-t w-full" : "border-l w-52 shrink-0"}`}>
            {controls}
          </div>
        )}
      </div>

      {showCode && code && (
        <div className="border-t border-neutral-100">
          <pre className="text-[11px] font-mono text-neutral-600 bg-neutral-950 text-green-400 p-4 overflow-x-auto leading-relaxed">
            {code}
          </pre>
        </div>
      )}

      {(description || useCase) && (
        <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50/40 flex flex-wrap gap-3">
          {description && (
            <span className="text-[11px] text-neutral-500">{description}</span>
          )}
          {useCase && (
            <span className="text-[11px] text-neutral-400">
              <span className="text-neutral-300 mr-1">→</span>
              {useCase}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: string;
}

export function SectionHeader({ title, subtitle, icon }: SectionHeaderProps) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-1">
        {icon && <span className="text-2xl">{icon}</span>}
        <h2 className="text-2xl font-black uppercase tracking-tighter text-neutral-900">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm text-neutral-500 ml-0">{subtitle}</p>
      )}
      <div className="mt-3 h-px bg-neutral-200" />
    </div>
  );
}
