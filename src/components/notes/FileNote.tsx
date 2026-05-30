import { useState, useEffect, useRef } from "react";
import {
  FileText, FileImage, FileCode, FileAudio, FileVideo,
  Archive, Download, File, FileSpreadsheet, Presentation,
  AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import type { Note } from "@/lib/types";
import { getFileColor } from "@/lib/fileColors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// File-type sets
const IMAGE_EXTS = new Set(["jpg","jpeg","png","gif","webp","svg","bmp","ico","tiff","avif"]);
const AUDIO_EXTS = new Set(["mp3","wav","flac","m4a","ogg","aac","opus"]);
const VIDEO_EXTS = new Set(["mp4","mov","avi","mkv","webm","m4v"]);
const CODE_EXTS  = new Set(["js","ts","tsx","jsx","py","rs","go","java","cpp","c","h","rb","php","html","css","json","yaml","yml","toml","sh","sql","md","txt","xml"]);
const ARCH_EXTS  = new Set(["zip","rar","7z","tar","gz","bz2"]);

function FileTypeIcon({ ext, color, size = "md" }: { ext: string; color: string; size?: "sm" | "md" | "lg" }) {
  const e   = ext.toLowerCase();
  const szMap = { sm: "w-4 h-4", md: "w-6 h-6", lg: "w-10 h-10" };
  const cls = szMap[size];
  const s   = { color };
  if (IMAGE_EXTS.has(e))          return <FileImage      className={cls} style={s} />;
  if (AUDIO_EXTS.has(e))          return <FileAudio      className={cls} style={s} />;
  if (VIDEO_EXTS.has(e))          return <FileVideo      className={cls} style={s} />;
  if (CODE_EXTS.has(e))           return <FileCode       className={cls} style={s} />;
  if (ARCH_EXTS.has(e))           return <Archive        className={cls} style={s} />;
  if (e === "pdf")                 return <FileText       className={cls} style={s} />;
  if (["xls","xlsx","csv","ods"].includes(e)) return <FileSpreadsheet className={cls} style={s} />;
  if (["ppt","pptx","odp"].includes(e))       return <Presentation   className={cls} style={s} />;
  if (["doc","docx","odt","rtf"].includes(e)) return <FileText       className={cls} style={s} />;
  return <File className={cls} style={s} />;
}

// ── Document preview loaders (dynamic imports) ────────────────────────────────

type PreviewResult =
  | { kind: "image" | "video" | "audio" | "pdf" | "iframe" }
  | { kind: "text";  content: string }
  | { kind: "docx";  html: string }
  | { kind: "xlsx";  sheets: { name: string; rows: string[][] }[]; }
  | { kind: "pptx";  slides: { text: string }[] }
  | { kind: "none" }
  | { kind: "error"; message: string };

async function loadDocx(url: string): Promise<PreviewResult> {
  try {
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    const mammoth = await import("mammoth");
    const result  = await mammoth.convertToHtml({ arrayBuffer: buf });
    return { kind: "docx", html: result.value };
  } catch (e) {
    return { kind: "error", message: "Could not render document" };
  }
}

async function loadXlsx(url: string): Promise<PreviewResult> {
  try {
    const buf  = await fetch(url).then((r) => r.arrayBuffer());
    const XLSX = await import("xlsx");
    const wb   = XLSX.read(buf, { type: "array" });
    const sheets = wb.SheetNames.map((name) => ({
      name,
      rows: (XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1, defval: "", blankrows: false,
      }) as string[][]).slice(0, 60),
    }));
    return { kind: "xlsx", sheets };
  } catch (e) {
    return { kind: "error", message: "Could not parse spreadsheet" };
  }
}

async function loadPptx(url: string): Promise<PreviewResult> {
  try {
    const buf            = await fetch(url).then((r) => r.arrayBuffer());
    const { default: JSZip } = await import("jszip");
    const zip            = await JSZip.loadAsync(buf);

    // Collect slide XML files in order
    const slideKeys = Object.keys(zip.files)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => {
        const n = (s: string) => parseInt(s.match(/\d+/)?.[0] ?? "0", 10);
        return n(a) - n(b);
      })
      .slice(0, 30);

    const slides: { text: string }[] = [];
    for (const key of slideKeys) {
      const xml   = await zip.files[key].async("string");
      // Extract all text runs (<a:t>) — covers title, body, shapes
      const texts = [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
        .map((m) => m[1].trim())
        .filter(Boolean);
      slides.push({ text: texts.join("  ·  ") || "" });
    }
    return { kind: "pptx", slides };
  } catch (e) {
    return { kind: "error", message: "Could not parse presentation" };
  }
}

async function loadTextFile(url: string): Promise<PreviewResult> {
  try {
    const text = await fetch(url).then((r) => r.text());
    return { kind: "text", content: text.slice(0, 4000) };
  } catch {
    return { kind: "error", message: "Could not read file" };
  }
}

// ── Preview area components ────────────────────────────────────────────────────

function DocxPreview({ html }: { html: string }) {
  return (
    <div
      className="w-full h-full overflow-auto p-3 text-[11px] leading-relaxed text-[var(--color-foreground)] [&_h1]:text-base [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold [&_strong]:font-semibold [&_em]:italic [&_p]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-1 [&_th]:border [&_th]:border-[var(--color-border)] [&_th]:px-1 [&_th]:font-semibold"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function XlsxPreview({ sheets }: { sheets: { name: string; rows: string[][] }[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const sheet = sheets[activeIdx];
  if (!sheet) return null;

  // Limit cols to first 12
  const maxCols = Math.min(
    12,
    sheet.rows.reduce((m, r) => Math.max(m, r.length), 0)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex gap-1 px-2 pt-1 pb-0.5 overflow-x-auto flex-shrink-0 border-b border-[var(--color-border)]">
          {sheets.map((s, i) => (
            <button
              key={s.name}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setActiveIdx(i); }}
              className={`text-[9px] px-2 py-0.5 rounded-t whitespace-nowrap ${
                i === activeIdx
                  ? "bg-[var(--color-card)] text-[var(--color-foreground)] border border-b-0 border-[var(--color-border)]"
                  : "text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="text-[9px] border-collapse w-full">
          <tbody>
            {sheet.rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-[var(--color-muted)] font-semibold" : "even:bg-[var(--color-muted)]/40"}>
                {Array.from({ length: maxCols }).map((_, ci) => (
                  <td
                    key={ci}
                    className="border border-[var(--color-border)] px-1.5 py-0.5 whitespace-nowrap max-w-[80px] overflow-hidden text-ellipsis text-[var(--color-foreground)]"
                  >
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PptxPreview({ slides }: { slides: { text: string }[] }) {
  const [idx, setIdx] = useState(0);
  const total = slides.length;
  if (total === 0) return (
    <div className="flex items-center justify-center h-full text-[var(--color-muted-foreground)] text-xs p-4 text-center">
      No text content found in slides
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Slide */}
      <div className="flex-1 min-h-0 overflow-auto p-3">
        <p className="text-[10px] font-medium text-[var(--color-muted-foreground)] mb-1">
          Slide {idx + 1} / {total}
        </p>
        <p className="text-xs leading-relaxed text-[var(--color-foreground)] whitespace-pre-wrap break-words">
          {slides[idx].text || <em className="text-[var(--color-muted-foreground)]">Empty slide</em>}
        </p>
      </div>

      {/* Navigation */}
      {total > 1 && (
        <div className="flex items-center justify-between px-2 py-1.5 border-t border-[var(--color-border)] flex-shrink-0">
          <button
            className="p-1 rounded hover:bg-[var(--color-muted)] disabled:opacity-30 transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.max(0, i - 1)); }}
            disabled={idx === 0}
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[var(--color-foreground)]" />
          </button>
          <div className="flex gap-1">
            {slides.slice(0, 12).map((_, i) => (
              <button
                key={i}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === idx ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)] hover:bg-[var(--color-muted-foreground)]"
                }`}
              />
            ))}
            {slides.length > 12 && (
              <span className="text-[9px] text-[var(--color-muted-foreground)] ml-0.5">…</span>
            )}
          </div>
          <button
            className="p-1 rounded hover:bg-[var(--color-muted)] disabled:opacity-30 transition-colors"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setIdx((i) => Math.min(total - 1, i + 1)); }}
            disabled={idx === total - 1}
          >
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-foreground)]" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main FileNote ─────────────────────────────────────────────────────────────

interface FileNoteProps { note: Note }

export function FileNote({ note }: FileNoteProps) {
  const ext   = (note.content.fileExtension ?? "").toLowerCase();
  const color = getFileColor(ext);
  const name  = note.content.fileName ?? "File";
  const size  = note.content.fileSize;
  const url   = note.content.url;

  const isImage = IMAGE_EXTS.has(ext);
  const isAudio = AUDIO_EXTS.has(ext);
  const isVideo = VIDEO_EXTS.has(ext);
  const isPdf   = ext === "pdf";
  const isText  = CODE_EXTS.has(ext);
  const isDocx  = ext === "docx";
  const isXlsx  = ["xlsx","xls","ods"].includes(ext);
  const isPptx  = ext === "pptx";
  const isCsv   = ext === "csv";

  // Determine loader type
  const loaderType: "native" | "text" | "docx" | "xlsx" | "pptx" | "none" = (() => {
    if (isImage || isAudio || isVideo || isPdf) return "native";
    if (isText || isCsv) return "text";
    if (isDocx) return "docx";
    if (isXlsx || isCsv) return "xlsx";
    if (isPptx) return "pptx";
    return "none";
  })();

  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const loadedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!url || loaderType === "native" || loaderType === "none") return;
    if (loadedUrl.current === url) return; // already loaded
    loadedUrl.current = url;

    setPreview(null); // reset

    if (loaderType === "text") {
      // CSV as xlsx table
      if (isCsv) {
        loadXlsx(url).then(setPreview);
      } else {
        loadTextFile(url).then(setPreview);
      }
    } else if (loaderType === "docx") {
      loadDocx(url).then(setPreview);
    } else if (loaderType === "xlsx") {
      loadXlsx(url).then(setPreview);
    } else if (loaderType === "pptx") {
      loadPptx(url).then(setPreview);
    }
  }, [url, loaderType, isCsv]);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  const hasPreviewArea = loaderType !== "none";

  return (
    <div className="relative w-full h-full flex flex-col bg-[var(--color-card)] overflow-hidden group select-none">

      {/* Accent bar */}
      <div className="absolute top-0 inset-x-0 h-[3px] z-10 flex-shrink-0" style={{ backgroundColor: color }} />

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-2 flex-shrink-0 min-w-0">
        <div
          className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ backgroundColor: color + "20", border: `1.5px solid ${color}50` }}
        >
          <FileTypeIcon ext={ext} color={color} size="sm" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[var(--color-foreground)] truncate leading-snug" title={name}>
            {name}
          </p>
          <p className="text-[10px] text-[var(--color-muted-foreground)] leading-tight mt-0.5">
            {ext ? ext.toUpperCase() : "FILE"}
            {size !== undefined && ` · ${formatBytes(size)}`}
          </p>
        </div>
        {url && (
          <button
            className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-[var(--color-muted)]"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleDownload}
            title="Download"
          >
            <Download className="w-3.5 h-3.5" style={{ color }} />
          </button>
        )}
      </div>

      {/* ── Preview / content area ─────────────────────────────────────────────── */}
      {hasPreviewArea && (
        <>
          <div className="mx-3 h-px bg-[var(--color-border)] flex-shrink-0" />
          <div className="flex-1 min-h-0 overflow-hidden mx-2 mb-2 mt-2 rounded-lg bg-[var(--color-muted)] relative">

            {/* Native browser previews */}
            {isImage && url && (
              <img src={url} alt={name} draggable={false} className="w-full h-full object-contain" />
            )}
            {isVideo && url && (
              <video src={url} className="w-full h-full object-contain" controls onMouseDown={(e) => e.stopPropagation()} />
            )}
            {isAudio && url && (
              <div className="flex flex-col items-center justify-center h-full p-4 gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full"
                  style={{ backgroundColor: color + "20", border: `1.5px solid ${color}50` }}>
                  <FileAudio className="w-6 h-6" style={{ color }} />
                </div>
                <audio src={url} controls className="w-full max-w-[200px]" onMouseDown={(e) => e.stopPropagation()} />
              </div>
            )}
            {isPdf && url && (
              <iframe src={url} title={name} className="w-full h-full border-0" />
            )}

            {/* Loading state */}
            {loaderType !== "native" && !preview && (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-2 text-[var(--color-muted-foreground)]">
                  <div className="w-5 h-5 border-2 border-[var(--color-border)] border-t-[var(--color-primary)] rounded-full animate-spin" />
                  <span className="text-[10px]">Loading preview…</span>
                </div>
              </div>
            )}

            {/* Loaded previews */}
            {preview?.kind === "text"  && <pre className="p-2 text-[10px] font-mono leading-relaxed text-[var(--color-foreground)] overflow-hidden whitespace-pre-wrap break-all" style={{ opacity: 0.9 }}>{preview.content}</pre>}
            {preview?.kind === "docx"  && <DocxPreview html={preview.html} />}
            {preview?.kind === "xlsx"  && <XlsxPreview sheets={preview.sheets} />}
            {preview?.kind === "pptx"  && <PptxPreview slides={preview.slides} />}

            {/* Error state */}
            {preview?.kind === "error" && (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4 text-center">
                <AlertCircle className="w-8 h-8 text-[var(--color-muted-foreground)] opacity-50" />
                <p className="text-[11px] text-[var(--color-muted-foreground)]">{preview.message}</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── No-preview fallback ────────────────────────────────────────────────── */}
      {!hasPreviewArea && (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 pb-3">
          <div
            className="relative flex items-center justify-center w-14 h-14 rounded-2xl"
            style={{ backgroundColor: color + "18", border: `1.5px solid ${color}44` }}
          >
            <FileTypeIcon ext={ext} color={color} />
            {ext && (
              <span
                className="absolute -bottom-2.5 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full text-white tracking-wide shadow-sm"
                style={{ backgroundColor: color }}
              >
                {ext}
              </span>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-muted-foreground)] text-center px-3 line-clamp-2 leading-snug mt-1">
            {name}
          </p>
          <p className="text-[9px] text-[var(--color-muted-foreground)] opacity-60">No preview available</p>
        </div>
      )}
    </div>
  );
}
