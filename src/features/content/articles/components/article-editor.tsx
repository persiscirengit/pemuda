"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  Languages,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as React from "react";
import { Button } from "@/components/ui/button";

export interface ArticleEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

export function ArticleEditor({
  value,
  onChange,
  placeholder,
}: ArticleEditorProps) {
  const t = useTranslations("articles.editor");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    extensions: [StarterKit],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none p-4 min-h-[300px]",
        "data-placeholder": placeholder || "",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep editor content in sync when value changes from outside (e.g. form reset or prefill)
  React.useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!mounted || !editor) {
    return (
      <div className="min-h-[350px] w-full rounded-md border border-input bg-background p-4 animate-pulse" />
    );
  }

  const insertArabicQuote = () => {
    /* cspell:disable */
    const defaultQuote =
      '<blockquote class="arabic" dir="rtl" lang="ar"><p class="arabic">اقتباس عربي مبارك...</p></blockquote>';
    /* cspell:enable */
    editor.chain().focus().insertContent(defaultQuote).run();
  };

  return (
    <div className="flex flex-col rounded-md border border-input bg-background shadow-xs overflow-hidden">
      {/* TipTap Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          title={t("bold")}
          aria-label={t("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          title={t("italic")}
          aria-label={t("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant={editor.isActive("strike") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          title={t("strike")}
          aria-label={t("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          type="button"
          variant={
            editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"
          }
          size="sm"
          className="h-8 w-8 p-0"
          title={t("h2")}
          aria-label={t("h2")}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant={
            editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"
          }
          size="sm"
          className="h-8 w-8 p-0"
          title={t("h3")}
          aria-label={t("h3")}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          title={t("bulletList")}
          aria-label={t("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          title={t("orderedList")}
          aria-label={t("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant={editor.isActive("blockquote") ? "secondary" : "ghost"}
          size="sm"
          className="h-8 w-8 p-0"
          title={t("blockquote")}
          aria-label={t("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Specialized RTL Arabic blockquote inserter */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs flex items-center gap-1 font-medium"
          title={t("arabicQuote")}
          aria-label={t("arabicQuote")}
          onClick={insertArabicQuote}
        >
          <Languages className="h-4 w-4" />
          <span>{t("arabicQuote")}</span>
        </Button>

        <div className="h-4 w-px bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={t("undo")}
          aria-label={t("undo")}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          title={t("redo")}
          aria-label={t("redo")}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor Content Area */}
      <EditorContent editor={editor} />
    </div>
  );
}
