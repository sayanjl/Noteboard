import React, { useEffect } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import {
  Bold, Italic, Strikethrough, Code, Quote,
  List, ListOrdered, CheckSquare, Minus, FileCode,
  Heading1, Heading2, Heading3,
} from "lucide-react";

// ── Toolbar helpers ───────────────────────────────────────────────────────────

function TB({
  title, active, onAct, children,
}: {
  title: string; active?: boolean; onAct: () => void; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      className={`p-[3px] rounded transition-colors flex-shrink-0 ${
        active
          ? "bg-[var(--color-muted)] text-[var(--color-foreground)]"
          : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
      }`}
      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onClick={onAct}
    >
      {children}
    </button>
  );
}

const SEP = () => (
  <span className="w-px h-3.5 bg-[var(--color-border)] mx-0.5 flex-shrink-0" />
);

function EditorToolbar({ editor, iconSize = 14 }: { editor: Editor | null; iconSize?: number }) {
  if (!editor) return null;
  const ch = () => editor.chain().focus();
  const s = { width: iconSize, height: iconSize } as React.CSSProperties;
  return (
    <div className="flex items-center gap-px flex-wrap">
      <TB title="H1" active={editor.isActive("heading", { level: 1 })} onAct={() => ch().toggleHeading({ level: 1 }).run()}><Heading1 style={s} /></TB>
      <TB title="H2" active={editor.isActive("heading", { level: 2 })} onAct={() => ch().toggleHeading({ level: 2 }).run()}><Heading2 style={s} /></TB>
      <TB title="H3" active={editor.isActive("heading", { level: 3 })} onAct={() => ch().toggleHeading({ level: 3 }).run()}><Heading3 style={s} /></TB>
      <SEP />
      <TB title="Bold"          active={editor.isActive("bold")}        onAct={() => ch().toggleBold().run()}>          <Bold style={s} /></TB>
      <TB title="Italic"        active={editor.isActive("italic")}      onAct={() => ch().toggleItalic().run()}>        <Italic style={s} /></TB>
      <TB title="Strikethrough" active={editor.isActive("strike")}      onAct={() => ch().toggleStrike().run()}>       <Strikethrough style={s} /></TB>
      <TB title="Code"          active={editor.isActive("code")}        onAct={() => ch().toggleCode().run()}>          <Code style={s} /></TB>
      <SEP />
      <TB title="Blockquote"    active={editor.isActive("blockquote")}  onAct={() => ch().toggleBlockquote().run()}>    <Quote style={s} /></TB>
      <TB title="Bullet list"   active={editor.isActive("bulletList")}  onAct={() => ch().toggleBulletList().run()}>    <List style={s} /></TB>
      <TB title="Numbered list" active={editor.isActive("orderedList")} onAct={() => ch().toggleOrderedList().run()}>   <ListOrdered style={s} /></TB>
      <TB title="Checklist"     active={editor.isActive("taskList")}    onAct={() => ch().toggleTaskList().run()}>      <CheckSquare style={s} /></TB>
      <SEP />
      <TB title="Code block"    active={editor.isActive("codeBlock")}   onAct={() => ch().toggleCodeBlock().run()}>     <FileCode style={s} /></TB>
      <TB title="Divider"       onAct={() => ch().setHorizontalRule().run()}>                                           <Minus style={s} /></TB>
    </div>
  );
}

// ── RichTextEditor ─────────────────────────────────────────────────────────────

export interface RichTextEditorProps {
  content: string;
  onChange?: (markdown: string) => void;
  editable?: boolean;
  onBlur?: () => void;
  placeholder?: string;
  showToolbar?: boolean;
  toolbarIconSize?: number;
  /** Extra classes applied to the ProseMirror content area */
  contentClassName?: string;
}

export function RichTextEditor({
  content,
  onChange,
  editable = true,
  onBlur,
  placeholder = "Start writing…",
  showToolbar = true,
  toolbarIconSize = 14,
  contentClassName = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onChange?.((editor.storage as any).markdown.getMarkdown());
    },
    onBlur: () => onBlur?.(),
    editorProps: {
      attributes: { class: `rte-content focus:outline-none ${contentClassName}` },
    },
  });

  // Keep editable in sync with prop
  useEffect(() => {
    if (editor && editor.isEditable !== editable) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Sync external content changes only when the editor is not focused
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current: string = (editor.storage as any).markdown.getMarkdown();
    if (current !== content) {
      editor.commands.setContent(content ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {showToolbar && editable && (
        <div
          className="flex items-center gap-px px-2 pt-1.5 pb-1 border-b border-[var(--color-border)] flex-shrink-0 flex-wrap"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <EditorToolbar editor={editor} iconSize={toolbarIconSize} />
        </div>
      )}
      <EditorContent editor={editor} className="flex-1 overflow-auto" />
    </div>
  );
}
