import React from "react";
import { EditorContent, useEditor, type Editor, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Node, mergeAttributes } from "@tiptap/core";

import katex from "katex";
import "katex/dist/katex.min.css";

import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Highlighter,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Link2Off,
  Undo2,
  Redo2,
  Sigma,
  X,
} from "lucide-react";

/* =====================================================
   MATH INLINE (Tiptap v3) via React NodeView + KaTeX
===================================================== */
function MathInlineView({ node }: any) {
  const latex = node.attrs?.latex || "";
  const html = katex.renderToString(latex, { throwOnError: false });

  return (
    <NodeViewWrapper
      as="span"
      data-math-inline="true"
      className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 align-middle"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

const MathInline = Node.create({
  name: "mathInline",
  group: "inline",
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-latex") || "",
        renderHTML: (attrs) => ({
          "data-latex": attrs.latex || "",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-math-inline]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-math-inline": "true",
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathInlineView);
  },

  addCommands() {
    return {
      insertMath:
        (latex: string) =>
          ({ commands }) =>
            commands.insertContent({
              type: this.name,
              attrs: { latex },
            }),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    mathInline: {
      insertMath: (latex: string) => ReturnType;
    };
  }
}

/* =====================================================
   HOOK DO EDITOR
===================================================== */
export function useRichEditor(initialHtml: string) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      MathInline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: "",
        emptyEditorClass:
          "before:content-[attr(data-placeholder)] before:float-left before:text-slate-400 before:pointer-events-none",
      }),
    ],
    content: initialHtml || "<p></p>",
    editorProps: {
      attributes: {
        "data-placeholder": "",
        class: [
          "min-h-[140px] px-3 py-2 text-sm outline-none",
          "prose prose-sm max-w-none",
          "[&_p]:my-2",
          "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2",
          "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2",
          "[&_li]:my-1",
          "[&_a]:text-emerald-700 [&_a]:underline",
        ].join(" "),
      },
    },
  });

  return {
    editor,
    getHtml: () => editor?.getHTML() ?? "",
  };
}

/* =====================================================
   COMPONENTE PRINCIPAL
===================================================== */
export default function RichEditor({
  editor,
  placeholder,
}: {
  editor: Editor | null;
  placeholder?: string;
}) {
  const [openFormula, setOpenFormula] = React.useState(false);
  const [latex, setLatex] = React.useState("");

  const [openLink, setOpenLink] = React.useState(false);
  const [linkUrl, setLinkUrl] = React.useState("");


  if (!editor) return null;

  // aplica placeholder no editor (sem overlay)
  React.useEffect(() => {
    editor.setOptions({
      editorProps: {
        attributes: {
          ...(editor.options.editorProps?.attributes ?? {}),
          "data-placeholder": placeholder || "",
        },
      },
    });
  }, [editor, placeholder]);

  const canUndo = editor ? editor.can().chain().focus().undo().run() : false;
  const canRedo = editor ? editor.can().chain().focus().redo().run() : false;
  const linkActive = editor ? editor.isActive("link") : false;

  function openLinkModal() {
    const prev = (editor.getAttributes("link").href as string | undefined) || "";
    setLinkUrl(prev);
    setOpenLink(true);
  }

  function applyLink() {
    if (!editor) return;

    const raw = linkUrl.trim();

    // se ficar vazio -> remove link
    if (!raw) {
      editor.chain().focus().unsetLink().run();
      setOpenLink(false);
      setLinkUrl("");
      return;
    }

    // normaliza protocolo
    const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setOpenLink(false);
  }


  function insertFormula() {
    if (!editor) return;
    const v = latex.trim();
    if (!v) return;
    editor.chain().focus().insertMath(v).run();
    setOpenFormula(false);
    setLatex("");
  }

  // Preview KaTeX no modal
  const previewHtml = React.useMemo(() => {
    const v = latex.trim();
    if (!v) return "";
    return katex.renderToString(v, { throwOnError: false });
  }, [latex]);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <Btn
          title="Negrito"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={16} />
        </Btn>

        <Btn
          title="Itálico"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={16} />
        </Btn>

        <Btn
          title="Sublinhado"
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon size={16} />
        </Btn>

        <Btn
          title="Marca-texto"
          active={editor.isActive("highlight")}
          onClick={() => editor.chain().focus().toggleHighlight().run()}
        >
          <Highlighter size={16} />
        </Btn>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <Btn
          title="Lista com marcadores"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={16} />
        </Btn>

        <Btn
          title="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={16} />
        </Btn>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <Btn
          title="Alinhar à esquerda"
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft size={16} />
        </Btn>

        <Btn
          title="Centralizar"
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter size={16} />
        </Btn>

        <Btn
          title="Alinhar à direita"
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight size={16} />
        </Btn>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <Btn title="Inserir fórmula (LaTeX)" onClick={() => setOpenFormula(true)}>
          <Sigma size={16} />
        </Btn>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <Btn title="Inserir/editar link" active={linkActive} onClick={openLinkModal}>
          <LinkIcon size={16} />
        </Btn>


        <Btn title="Remover link" disabled={!linkActive} onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off size={16} />
        </Btn>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <Btn title="Desfazer" disabled={!canUndo} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 size={16} />
        </Btn>

        <Btn title="Refazer" disabled={!canRedo} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 size={16} />
        </Btn>
      </div>

      {/* Conteúdo */}
      <div className="bg-white">
        <EditorContent editor={editor} />
      </div>

      {/* Modal Fórmula */}
      {openFormula && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-[520px] rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
              <div className="text-sm font-semibold text-slate-800">Inserir fórmula (LaTeX)</div>
              <button
                type="button"
                onClick={() => {
                  setOpenFormula(false);
                  setLatex("");
                }}
                className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <textarea
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                placeholder={`Ex: \\frac{1}{2}, \\sqrt{2}, x^2, \\sum_{i=1}^{n} i`}
                className="w-full min-h-[96px] rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
              />

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 min-h-[52px]">
                {previewHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                ) : (
                  <div className="text-sm text-slate-400">Pré-visualização da fórmula…</div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                  onClick={() => {
                    setOpenFormula(false);
                    setLatex("");
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  onClick={insertFormula}
                  disabled={!latex.trim()}
                >
                  Inserir
                </button>
              </div>

              <div className="text-xs text-slate-500">
                Dica: use comandos como <code className="px-1 py-0.5 rounded bg-white border">\frac</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border">\sqrt</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border">\sum</code>,{" "}
                <code className="px-1 py-0.5 rounded bg-white border">^</code> e{" "}
                <code className="px-1 py-0.5 rounded bg-white border">_</code>.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Link */}
      {openLink && (
        <div className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4">
          <div className="w-full max-w-[520px] rounded-xl bg-white border border-slate-200 shadow-lg overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200">
              <div className="text-sm font-semibold text-slate-800">
                {linkActive ? "Editar link" : "Inserir link"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpenLink(false);
                  setLinkUrl("");
                }}
                className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">URL</label>
                <input
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="ex: https://site.com ou site.com"
                  className="w-full rounded-lg border border-slate-200 p-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyLink();
                  }}

                />
              </div>

              <div className="flex justify-between gap-2 pt-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-60"
                  onClick={() => {
                    editor.chain().focus().unsetLink().run();
                    setOpenLink(false);
                    setLinkUrl("");
                  }}
                  disabled={!linkActive}
                >
                  Remover link
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
                    onClick={() => {
                      setOpenLink(false);
                      setLinkUrl("");
                    }}
                  >
                    Cancelar
                  </button>

                  <button
                    type="button"
                    className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                    onClick={applyLink}
                    disabled={!linkUrl.trim()}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =====================================================
   BOTÃO TOOLBAR
===================================================== */
function Btn({
  children,
  onClick,
  active,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-md border p-2 transition flex items-center justify-center",
        "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
        active ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "",
        disabled ? "opacity-40 cursor-not-allowed hover:bg-white" : "",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* =====================================================
   HELPERS (exports usados no form)
===================================================== */
export function hasMeaningfulHtml(html: string) {
  const text = (html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0;
}

export function normalizeHtml(html: string) {
  const h = (html || "").trim();
  if (!h) return "<p></p>";
  return h.startsWith("<") ? h : `<p>${escapeHtml(h)}</p>`;
}

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
