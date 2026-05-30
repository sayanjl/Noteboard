import { Type, Image, Link, File, Plus, Table2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { classifyUrl, isUrl } from "@/lib/embeds";
import { fetchLinkPreview } from "@/lib/linkPreview";
import { measureImage } from "@/lib/imageSize";
import { makeDefaultTableContent } from "@/components/notes/TableNote";
import type { Note } from "@/lib/types";

const EMBED_SIZES: Record<string, { width: number; height: number }> = {
  youtube:   { width: 320, height: 200 },
  twitter:   { width: 300, height: 400 },
  instagram: { width: 300, height: 420 },
  link:      { width: 280, height: 180 },
};

const EMPTY_NOTES: Note[] = [];

interface ToolbarProps {
  boardId: string;
  canvasCenter: () => { x: number; y: number };
}

export function Toolbar({ boardId, canvasCenter }: ToolbarProps) {
  const addNote            = useStore((s) => s.addNote);
  const updateNote         = useStore((s) => s.updateNote);
  const notes              = useStore((s) => s.notesByBoard[boardId] ?? EMPTY_NOTES);
  const defaultNoteWidth   = useStore((s) => s.defaultNoteWidth);
  const defaultNoteHeight  = useStore((s) => s.defaultNoteHeight);
  const defaultFontSize    = useStore((s) => s.defaultFontSize);

  const maxZ = notes.reduce((m, n) => Math.max(m, n.zIndex), 0);

  const spawnNote = (partial: Omit<Note, "id" | "boardId" | "createdAt" | "updatedAt" | "zIndex">) => {
    const center = canvasCenter();
    // Stagger so rapid-created notes don't stack exactly
    const offset = (notes.length % 5) * 24;
    addNote({
      ...partial,
      boardId,
      zIndex: maxZ + 1,
      x: center.x - partial.width / 2 + offset,
      y: center.y - partial.height / 2 + offset,
    });
  };

  const addText = () =>
    spawnNote({ type: "text", x: 0, y: 0, width: defaultNoteWidth, height: defaultNoteHeight, content: { text: "" }, fontSize: defaultFontSize });

  const addTable = () =>
    spawnNote({ type: "table", x: 0, y: 0, width: 480, height: 280, content: makeDefaultTableContent() });

  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const url = URL.createObjectURL(file);
        const { width, height } = await measureImage(url);
        const center = canvasCenter();
        const offset = (notes.length + i) % 5 * 24;
        addNote({
          type: "image",
          boardId,
          zIndex: maxZ + 1 + i,
          x: center.x - width / 2 + offset,
          y: center.y - height / 2 + offset,
          width,
          height,
          content: { url, fileName: file.name },
        });
      }
    };
    input.click();
  };

  const addLink = () => {
    const raw = prompt("Paste a URL (YouTube, Twitter, Instagram, or any link):");
    if (!raw?.trim()) return;
    const url = raw.trim();
    if (!isUrl(url)) { alert("That doesn't look like a valid URL."); return; }
    const kind = classifyUrl(url);
    const { width, height } = EMBED_SIZES[kind];

    if (kind !== "link") {
      spawnNote({ type: kind, x: 0, y: 0, width, height, content: { url } });
      return;
    }

    // Link note: create immediately (linkTitle=undefined → shows spinner),
    // then fetch OG metadata and update
    const center = canvasCenter();
    const offset = (notes.length % 5) * 24;
    const note = addNote({
      type: "link",
      boardId,
      zIndex: maxZ + 1,
      x: center.x - width / 2 + offset,
      y: center.y - height / 2 + offset,
      width,
      height,
      content: { url },
    });

    fetchLinkPreview(url)
      .then((preview) => {
        updateNote(note.id, {
          content: {
            url,
            linkTitle: preview.title ?? "",
            linkDescription: preview.description ?? "",
            linkImage: preview.image ?? "",
            linkFavicon: preview.favicon ?? "",
          },
        });
      })
      .catch(() => {
        updateNote(note.id, { content: { url, linkTitle: "" } });
      });
  };

  const addFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = () => {
      Array.from(input.files ?? []).forEach((file, i) => {
        const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
        const url = URL.createObjectURL(file);
        const center = canvasCenter();
        const offset = (notes.length + i) % 5 * 24;
        addNote({
          type: "file",
          boardId,
          zIndex: maxZ + 1 + i,
          x: center.x - 90 + offset,
          y: center.y - 80 + offset,
          width: 180,
          height: 160,
          content: { url, fileName: file.name, fileExtension: ext, mimeType: file.type, fileSize: file.size },
        });
      });
    };
    input.click();
  };

  return (
    <TooltipProvider delayDuration={400}>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[var(--color-card)] border border-[var(--color-border)] shadow-xl z-40">
        <ToolButton icon={<Type   className="w-4 h-4" />} label="Text note" onClick={addText}   />
        <ToolButton icon={<Table2 className="w-4 h-4" />} label="Table"     onClick={addTable} />
        <ToolButton icon={<Image  className="w-4 h-4" />} label="Image"     onClick={addImage} />
        <ToolButton icon={<Link    className="w-4 h-4" />} label="Link"      onClick={addLink}  />
        <ToolButton icon={<File    className="w-4 h-4" />} label="File"      onClick={addFile}  />

        <div className="w-px h-6 bg-[var(--color-border)] mx-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              className="h-9 w-9 rounded-xl"
              onClick={addText}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New note</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

function ToolButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onClick}>
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
