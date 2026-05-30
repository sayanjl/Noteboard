import React from "react";
import { X, Sun, Moon, Monitor } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Theme } from "@/lib/store";
import { cn } from "@/lib/utils";

// ── Sub-components ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-muted-foreground)]">
        {label}
      </p>
      {children}
    </div>
  );
}

function ToggleRow({
  label, description, checked, onChange,
}: { label: string; description?: string; checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-foreground)] leading-none">{label}</p>
        {description && (
          <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5">{description}</p>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={cn(
          "relative flex-shrink-0 w-9 h-5 rounded-full transition-colors duration-200",
          checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
        )}
        onClick={onChange}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
          checked ? "translate-x-4" : "translate-x-0"
        )} />
      </button>
    </div>
  );
}

// ── SettingsModal ──────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export function SettingsModal({ onClose }: Props) {
  const theme            = useStore((s) => s.theme);
  const setTheme         = useStore((s) => s.setTheme);
  const snapToGrid       = useStore((s) => s.snapToGrid);
  const toggleSnapToGrid = useStore((s) => s.toggleSnapToGrid);
  const showDotGrid      = useStore((s) => s.showDotGrid);
  const toggleDotGrid    = useStore((s) => s.toggleDotGrid);
  const defaultNoteWidth  = useStore((s) => s.defaultNoteWidth);
  const defaultNoteHeight = useStore((s) => s.defaultNoteHeight);
  const defaultFontSize   = useStore((s) => s.defaultFontSize);
  const setNoteDefaults   = useStore((s) => s.setNoteDefaults);

  const THEMES: { value: Theme; icon: React.ReactNode; label: string }[] = [
    { value: "light",  icon: <Sun  size={13} />, label: "Light"  },
    { value: "system", icon: <Monitor size={13} />, label: "Auto" },
    { value: "dark",   icon: <Moon size={13} />, label: "Dark"   },
  ];

  const NOTE_SIZES = [
    { label: "Compact", w: 200, h: 140 },
    { label: "Medium",  w: 240, h: 160 },
    { label: "Large",   w: 320, h: 220 },
    { label: "Wide",    w: 400, h: 160 },
  ];

  const FONT_SIZES = [
    { label: "S", value: 12 },
    { label: "M", value: 14 },
    { label: "L", value: 18 },
    { label: "XL", value: 24 },
  ];

  return (
    <>
      {/* Backdrop — click to close */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-12 right-4 z-50 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-2xl flex flex-col"
        style={{ maxHeight: "calc(100vh - 80px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] flex-shrink-0">
          <h2 className="text-sm font-semibold text-[var(--color-foreground)]">Settings</h2>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-[var(--color-muted)] transition-colors text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">

          {/* ── Appearance ─────────────────────────────────────────────────── */}
          <Section label="Appearance">
            <div className="flex gap-1 p-1 rounded-lg bg-[var(--color-muted)]">
              {THEMES.map(({ value, icon, label }) => (
                <button
                  key={value}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    theme === value
                      ? "bg-[var(--color-card)] text-[var(--color-foreground)] shadow-sm"
                      : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  )}
                  onClick={() => setTheme(value)}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Canvas ─────────────────────────────────────────────────────── */}
          <Section label="Canvas">
            <ToggleRow
              label="Snap to grid"
              description="Align notes to a 24px grid"
              checked={snapToGrid}
              onChange={toggleSnapToGrid}
            />
            <ToggleRow
              label="Dot grid"
              description="Show background dot pattern"
              checked={showDotGrid}
              onChange={toggleDotGrid}
            />
          </Section>

          {/* ── New notes ──────────────────────────────────────────────────── */}
          <Section label="New notes">
            <p className="text-xs text-[var(--color-muted-foreground)]">Default size</p>
            <div className="grid grid-cols-2 gap-1.5">
              {NOTE_SIZES.map(({ label, w, h }) => {
                const active = defaultNoteWidth === w && defaultNoteHeight === h;
                return (
                  <button
                    key={label}
                    className={cn(
                      "px-3 py-2 rounded-lg text-left text-xs border transition-colors",
                      active
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-muted)]"
                    )}
                    onClick={() => setNoteDefaults({ width: w, height: h })}
                  >
                    <span className="font-semibold block">{label}</span>
                    <span className="text-[10px] opacity-60">{w} × {h}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-xs text-[var(--color-muted-foreground)] pt-1">Default font size</p>
            <div className="flex gap-1">
              {FONT_SIZES.map(({ label, value }) => (
                <button
                  key={value}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    defaultFontSize === value
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-foreground)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-muted)]"
                  )}
                  onClick={() => setNoteDefaults({ fontSize: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* ── Keyboard shortcuts hint ─────────────────────────────────────── */}
          <Section label="Shortcuts">
            <div className="space-y-1 text-xs text-[var(--color-muted-foreground)]">
              {[
                ["Double-click canvas", "New note"],
                ["Ctrl+G", "Group selected"],
                ["Delete / Backspace", "Delete selected"],
                ["Ctrl+A", "Select all"],
                ["Space + drag", "Pan canvas"],
                ["Ctrl+scroll", "Zoom"],
              ].map(([key, action]) => (
                <div key={key} className="flex justify-between gap-2">
                  <span className="font-mono bg-[var(--color-muted)] px-1.5 py-0.5 rounded text-[10px]">{key}</span>
                  <span>{action}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
