"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Panel,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
} from "@xyflow/react";
// @ts-ignore
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import {
  Plus, Save, Check, Trash2, MessageSquare, X, FolderPlus, LogOut,
  Search, Grid2x2, Grid2x2Check, Tag, Palette, List,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SlotData {
  slotId: string;
  displayNome: string | null;
  employeeNome: string | null;
  employeeChapa: string | null;
  situacao: string | null;
  comment: string | null;
}

interface OrgNodeData extends Record<string, unknown> {
  label: string;
  displayNome: string | null;
  employeeNome: string | null;
  employeeChapa: string | null;
  situacao?: string | null;
  comment?: string | null;
  isGroup?: boolean;
  color?: string | null;
  slots?: SlotData[];
  searchActive?: boolean;
  searchMatch?: boolean;
  onLabelChange?: (id: string, val: string) => void;
  onNomeChange?: (id: string, val: string) => void;
  onCommentChange?: (id: string, val: string) => void;
  onAddSlot?: (nodeId: string) => void;
  onRemoveSlot?: (nodeId: string, slotId: string) => void;
  onSlotNomeChange?: (nodeId: string, slotId: string, val: string) => void;
  onSlotCommentChange?: (nodeId: string, slotId: string, val: string) => void;
}

type OrgFlowNode = Node<OrgNodeData>;

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLOR_PALETTE: { label: string; value: string | null }[] = [
  { label: "Padrão",    value: null },
  { label: "Índigo",    value: "#6366f1" },
  { label: "Violeta",   value: "#7c3aed" },
  { label: "Azul",      value: "#3b82f6" },
  { label: "Ciano",     value: "#06b6d4" },
  { label: "Teal",      value: "#0d9488" },
  { label: "Esmeralda", value: "#10b981" },
  { label: "Verde",     value: "#22c55e" },
  { label: "Lima",      value: "#65a30d" },
  { label: "Âmbar",     value: "#d97706" },
  { label: "Laranja",   value: "#ea580c" },
  { label: "Vermelho",  value: "#dc2626" },
  { label: "Rosa",      value: "#db2777" },
  { label: "Ardósia",   value: "#475569" },
  { label: "Cinza",     value: "#6b7280" },
  { label: "Preto",     value: "#1e293b" },
];

const SITUACAO_STYLE: Record<string, { dot: string; text: string }> = {
  ATIVO:     { dot: "#22c55e", text: "Ativo" },
  AFASTADO:  { dot: "#f97316", text: "Afastado" },
  DESLIGADO: { dot: "#94a3b8", text: "Desligado" },
  FERIAS:    { dot: "#3b82f6", text: "Férias" },
  LICENCA:   { dot: "#a855f7", text: "Licença" },
};

const DEFAULT_ACCENT = "#94a3b8";

function nodeMatchesSearch(data: OrgNodeData, query: string): boolean {
  const q = query.toLowerCase();
  const slotsMatch = (data.slots ?? []).some(
    (s) => s.displayNome?.toLowerCase().includes(q) || s.employeeNome?.toLowerCase().includes(q)
  );
  return (
    !!data.label?.toLowerCase().includes(q) ||
    !!data.displayNome?.toLowerCase().includes(q) ||
    !!data.employeeNome?.toLowerCase().includes(q) ||
    slotsMatch
  );
}

// ─── Inline edit ──────────────────────────────────────────────────────────────

function InlineEdit({ value, onSave, className, inputClassName }: {
  value: string; onSave: (v: string) => void; className?: string; inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  function start(e: React.MouseEvent) { e.stopPropagation(); setVal(value); setEditing(true); setTimeout(() => ref.current?.select(), 10); }
  function commit() { if (val.trim()) onSave(val.trim()); setEditing(false); }
  function keyDown(e: React.KeyboardEvent) { e.stopPropagation(); if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }

  if (editing) {
    return (
      <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit} onKeyDown={keyDown}
        onClick={(e) => e.stopPropagation()} autoFocus
        className={inputClassName ?? "w-full bg-transparent border-b border-slate-300 outline-none text-[11px] font-bold uppercase tracking-wide"} />
    );
  }
  return <span className={className} onDoubleClick={start} title="Clique duplo para editar">{value}</span>;
}

// ─── Comment editor (small inline) ───────────────────────────────────────────

function CommentEditor({ comment, onSave, onClose }: {
  comment: string | null | undefined; onSave: (v: string) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(comment ?? "");
  function keyDown(e: React.KeyboardEvent) { e.stopPropagation(); if (e.key === "Escape") onClose(); }
  function save(e: React.MouseEvent) { e.stopPropagation(); onSave(val); onClose(); }
  return (
    <div className="p-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={keyDown}
        placeholder="Comentário para gestores…" rows={3} autoFocus
        className="w-full text-[10px] text-slate-700 border border-slate-200 rounded p-1.5 resize-none outline-none focus:border-blue-400 bg-white" />
      <div className="flex gap-1 justify-end">
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-[9px] text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">Cancelar</button>
        <button onClick={save} className="text-[9px] bg-slate-700 text-white rounded px-2 py-0.5 hover:bg-slate-800">Salvar</button>
      </div>
    </div>
  );
}

// ─── Comment indicator ────────────────────────────────────────────────────────

function CommentIndicator({ comment, onEdit, canEdit }: {
  comment: string | null | undefined;
  onEdit?: () => void;
  canEdit: boolean;
}) {
  if (!comment && !canEdit) return null;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
      title={comment || "Adicionar comentário"}
      className={`flex items-center justify-center w-5 h-5 rounded transition-colors ${
        comment ? "text-amber-500 hover:text-amber-600" : "text-slate-300 hover:text-slate-500"
      } ${canEdit ? "cursor-pointer" : "cursor-default"}`}
    >
      <MessageSquare className={`h-3 w-3 ${comment ? "fill-amber-100" : ""}`} />
    </button>
  );
}

// ─── OrgNode (cargo em destaque, nome secundário) ─────────────────────────────

function OrgNodeComponent({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const [editingComment, setEditingComment] = useState(false);
  const isVaga = !data.employeeNome && !data.displayNome;
  const sit = data.situacao ?? "ATIVO";
  const situStyle = SITUACAO_STYLE[sit] ?? SITUACAO_STYLE.ATIVO;
  const showStatus = !isVaga && data.situacao && data.situacao !== "ATIVO";

  const accent = (data.color as string | null) ?? DEFAULT_ACCENT;
  const displayName = data.displayNome || data.employeeNome;
  const canEditLabel = !!data.onLabelChange;
  const canEditComment = !!data.onCommentChange;
  const dimmed = data.searchActive && !data.searchMatch;
  const highlighted = data.searchActive && data.searchMatch;

  const handleStyle = { background: accent, border: "2px solid white", width: 10, height: 10, borderRadius: "50%" };

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div
        style={{
          width: 165,
          backgroundColor: "#ffffff",
          border: `1px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : "#e2e8f0"}`,
          borderLeft: `4px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : accent}`,
          boxShadow: highlighted ? "0 0 0 2px #fef3c7" : selected ? "0 0 0 2px #e0e7ff" : "0 1px 3px rgba(0,0,0,0.06)",
          borderRadius: 5,
          overflow: "hidden",
          opacity: dimmed ? 0.25 : 1,
          transition: "opacity 0.15s",
        }}
        className="font-sans"
      >
        {/* Cargo — destaque principal */}
        <div className="px-2.5 pt-2 pb-1.5 flex items-start gap-1">
          <div className="flex-1 min-w-0">
            {canEditLabel
              ? <InlineEdit value={data.label} onSave={(v) => data.onLabelChange!(id, v)}
                  className="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight block cursor-text hover:text-slate-600"
                  inputClassName="w-full bg-transparent border-b border-slate-300 outline-none text-[11px] font-bold text-slate-800 uppercase tracking-wide"
                />
              : <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight block">{data.label}</span>
            }
          </div>
          <CommentIndicator
            comment={data.comment}
            canEdit={canEditComment}
            onEdit={canEditComment ? () => setEditingComment((v) => !v) : undefined}
          />
        </div>

        <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "0 10px" }} />

        {/* Nome — secundário */}
        <div className="px-2.5 pt-1.5 pb-2">
          {isVaga ? (
            <span className="text-[10px] font-semibold text-amber-600 tracking-wide">VAGA EM ABERTO</span>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0">
                {canEditLabel
                  ? <InlineEdit value={displayName ?? ""} onSave={(v) => data.onNomeChange!(id, v)}
                      className="text-[10px] text-slate-500 leading-tight block cursor-text hover:text-slate-700 truncate"
                      inputClassName="w-full bg-transparent border-b border-slate-200 outline-none text-[10px] text-slate-500"
                    />
                  : <div className="text-[10px] text-slate-500 leading-tight truncate">{displayName}</div>
                }
              </div>
              {showStatus && (
                <span style={{ backgroundColor: situStyle.dot }}
                  className="shrink-0 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {situStyle.text}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Comment editor */}
        {editingComment && canEditComment && (
          <div className="border-t border-slate-100">
            <CommentEditor
              comment={data.comment}
              onSave={(v) => data.onCommentChange!(id, v)}
              onClose={() => setEditingComment(false)}
            />
          </div>
        )}
        {/* Comment read-only preview */}
        {!editingComment && data.comment && !canEditComment && (
          <div className="border-t border-slate-100 px-2.5 py-1 flex items-start gap-1">
            <MessageSquare className="h-3 w-3 text-amber-400 shrink-0 mt-0.5 fill-amber-50" />
            <span className="text-[9px] text-slate-500 leading-tight line-clamp-2">{data.comment}</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

// ─── Position group (mesma função, várias pessoas) ────────────────────────────

function PositionGroupNode({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const [editingSlotComment, setEditingSlotComment] = useState<string | null>(null);
  const accent = (data.color as string | null) ?? DEFAULT_ACCENT;
  const canEditLabel = !!data.onLabelChange;
  const canEditComment = !!data.onSlotCommentChange;
  const slots: SlotData[] = (data.slots as SlotData[] | undefined) ?? [];
  const dimmed = data.searchActive && !data.searchMatch;
  const highlighted = data.searchActive && data.searchMatch;

  const handleStyle = { background: accent, border: "2px solid white", width: 10, height: 10, borderRadius: "50%" };

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div
        style={{
          width: 200,
          backgroundColor: "#ffffff",
          border: `1px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : "#e2e8f0"}`,
          borderLeft: `4px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : accent}`,
          boxShadow: highlighted ? "0 0 0 2px #fef3c7" : selected ? "0 0 0 2px #e0e7ff" : "0 1px 3px rgba(0,0,0,0.06)",
          borderRadius: 5,
          overflow: "hidden",
          opacity: dimmed ? 0.25 : 1,
          transition: "opacity 0.15s",
        }}
        className="font-sans"
      >
        {/* Cabeçalho — função */}
        <div className="px-3 py-2 border-b border-slate-100">
          {canEditLabel
            ? <InlineEdit value={data.label} onSave={(v) => data.onLabelChange!(id, v)}
                className="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight block cursor-text hover:text-slate-600"
                inputClassName="w-full bg-transparent border-b border-slate-300 outline-none text-[11px] font-bold text-slate-800 uppercase tracking-wide"
              />
            : <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight block">{data.label}</span>
          }
        </div>

        {/* Linhas de colaboradores */}
        {slots.map((slot) => {
          const isVagaSlot = !slot.displayNome && !slot.employeeNome;
          const sit = slot.situacao ?? "ATIVO";
          const slotSitStyle = SITUACAO_STYLE[sit] ?? SITUACAO_STYLE.ATIVO;
          const showSlotStatus = !isVagaSlot && slot.situacao && slot.situacao !== "ATIVO";
          const slotName = slot.displayNome || slot.employeeNome;

          return (
            <div key={slot.slotId}>
              <div className="px-3 py-1.5 flex items-center gap-1 border-t border-slate-50 group">
                <div className="flex-1 min-w-0">
                  {canEditLabel ? (
                    <InlineEdit
                      value={slotName ?? "VAGA EM ABERTO"}
                      onSave={(v) => data.onSlotNomeChange!(id, slot.slotId, v)}
                      className={`text-[10px] leading-tight block cursor-text truncate ${isVagaSlot ? "font-semibold text-amber-600 hover:text-amber-700" : "text-slate-500 hover:text-slate-700"}`}
                      inputClassName="w-full bg-transparent border-b border-slate-200 outline-none text-[10px] text-slate-600"
                    />
                  ) : isVagaSlot ? (
                    <span className="text-[10px] font-semibold text-amber-600">VAGA EM ABERTO</span>
                  ) : (
                    <span className="text-[10px] text-slate-500 leading-tight block truncate">{slotName}</span>
                  )}
                </div>
                {showSlotStatus && (
                  <span style={{ backgroundColor: slotSitStyle.dot }}
                    className="shrink-0 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                    {slotSitStyle.text}
                  </span>
                )}
                <CommentIndicator
                  comment={slot.comment}
                  canEdit={canEditComment}
                  onEdit={canEditComment ? () => setEditingSlotComment((v) => v === slot.slotId ? null : slot.slotId) : undefined}
                />
                {canEditLabel && (
                  <button onClick={(e) => { e.stopPropagation(); data.onRemoveSlot!(id, slot.slotId); }}
                    className="shrink-0 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              {editingSlotComment === slot.slotId && canEditComment && (
                <div className="border-t border-slate-100 bg-slate-50">
                  <CommentEditor
                    comment={slot.comment}
                    onSave={(v) => data.onSlotCommentChange!(id, slot.slotId, v)}
                    onClose={() => setEditingSlotComment(null)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Botão adicionar (edit mode) */}
        {canEditLabel && (
          <button onClick={(e) => { e.stopPropagation(); data.onAddSlot!(id); }}
            className="w-full text-[9px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 py-1.5 border-t border-slate-100 flex items-center justify-center gap-1 transition-colors">
            <Plus className="h-3 w-3" /> Adicionar posição
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

// ─── Carteira container ───────────────────────────────────────────────────────

function CarteiraGroupNode({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const canEdit = !!data.onLabelChange;
  const dimmed = data.searchActive && !data.searchMatch;
  const color = (data.color as string | null) ?? "#64748b";

  return (
    <div style={{
      width: "100%", height: "100%", borderRadius: 10,
      border: `2px solid ${selected ? "#6366f1" : color}`,
      overflow: "hidden",
      boxShadow: selected ? "0 0 0 2px #e0e7ff, 0 6px 24px rgba(0,0,0,0.10)" : "0 4px 16px rgba(0,0,0,0.07)",
      backgroundColor: "rgba(248,250,252,0.75)",
      backdropFilter: "blur(2px)",
      opacity: dimmed ? 0.3 : 1,
      transition: "opacity 0.15s",
    }}>
      <div style={{ backgroundColor: color, height: 48 }} className="px-4 flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          {canEdit
            ? <InlineEdit value={data.label} onSave={(v) => data.onLabelChange!(id, v)}
                className="text-white text-[12px] font-bold tracking-widest uppercase cursor-text hover:opacity-80 block truncate" />
            : <span className="text-white text-[12px] font-bold tracking-widest uppercase block truncate">{data.label}</span>}
        </div>
        {data.displayNome && (
          <span className="shrink-0 bg-white/20 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            {canEdit
              ? <InlineEdit value={data.displayNome} onSave={(v) => data.onNomeChange!(id, v)}
                  className="text-white text-[11px] font-semibold cursor-text hover:opacity-80"
                  inputClassName="bg-transparent border-b border-white/50 outline-none text-[11px] font-semibold text-white w-24 text-center" />
              : data.displayNome}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Section label (base / área) ──────────────────────────────────────────────

function SectionLabelNode({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const color = (data.color as string | null) ?? "#64748b";
  const canEditInline = !!data.onLabelChange;
  const dimmed = data.searchActive && !data.searchMatch;
  const highlighted = data.searchActive && data.searchMatch;
  const handleStyle = { background: color, border: "2px solid white", width: 10, height: 10, borderRadius: "50%" };

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div style={{
        backgroundColor: color,
        border: `2px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : color}`,
        boxShadow: highlighted ? "0 0 0 3px #fbbf24" : selected ? "0 0 0 2px #6366f1" : "0 2px 8px rgba(0,0,0,0.12)",
        opacity: dimmed ? 0.25 : 1,
        minWidth: 180,
        borderRadius: 6,
        padding: "8px 20px",
        textAlign: "center",
        transition: "opacity 0.15s",
      }}>
        {canEditInline
          ? <InlineEdit value={data.label} onSave={(v) => data.onLabelChange!(id, v)}
              className="text-white text-sm font-bold tracking-widest uppercase cursor-text hover:opacity-80 block" />
          : <span className="text-white text-sm font-bold tracking-widest uppercase block">{data.label}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

const nodeTypes = {
  orgNode: OrgNodeComponent,
  carteiraGroup: CarteiraGroupNode,
  sectionLabel: SectionLabelNode,
  positionGroup: PositionGroupNode,
};

// ─── Fit-to-new-node helper ───────────────────────────────────────────────────

function FitNewNode({ nodeId, onDone }: { nodeId: string | null; onDone: () => void }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!nodeId) return;
    // Wait one frame so React Flow has rendered the new node
    const raf = requestAnimationFrame(() => {
      fitView({ nodes: [{ id: nodeId }], duration: 350, padding: 0.5, maxZoom: 1.5 });
      onDone();
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);
  return null;
}

// ─── Search panel ─────────────────────────────────────────────────────────────

function SearchPanel({ nodes, searchQuery, setSearchQuery }: {
  nodes: OrgFlowNode[]; searchQuery: string; setSearchQuery: (q: string) => void;
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const matches = nodes.filter((n) => nodeMatchesSearch(n.data, searchQuery));
    if (matches.length > 0) fitView({ nodes: matches.map((n) => ({ id: n.id })), duration: 400, padding: 0.5, maxZoom: 1.5 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const matchCount = searchQuery.trim() ? nodes.filter((n) => nodeMatchesSearch(n.data, searchQuery)).length : 0;

  return (
    <Panel position="top-left">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nome ou cargo…"
            className="h-9 pl-8 pr-7 rounded-md border border-slate-200 bg-white/95 shadow-sm text-sm text-slate-700 outline-none focus:border-blue-400 w-60" />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {searchQuery.trim() && (
          <span className="text-xs bg-white/95 border rounded-md px-2 py-1 shadow-sm text-slate-500 whitespace-nowrap">
            {matchCount === 0 ? "Sem resultados" : `${matchCount} encontrado${matchCount !== 1 ? "s" : ""}`}
          </span>
        )}
      </div>
    </Panel>
  );
}

// ─── Main editor ──────────────────────────────────────────────────────────────

interface OrgFlowEditorProps {
  projectId: string;
  initialNodes: OrgFlowNode[];
  initialEdges: Edge[];
  canEdit: boolean;
  canEditComments: boolean;
}

const DEFAULT_EDGE = {
  type: "smoothstep",
  animated: false,
  style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
};

const SNAP_GRID: [number, number] = [20, 20];

export function OrgFlowEditor({ projectId, initialNodes, initialEdges, canEdit, canEditComments }: OrgFlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [pendingFitNode, setPendingFitNode] = useState<string | null>(null);

  // ── Callbacks de edição ──────────────────────────────────────────────────
  const onLabelChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: val } } : n));
  }, [setNodes]);

  const onNomeChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, displayNome: val } } : n));
  }, [setNodes]);

  const onCommentChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, comment: val || null } } : n));
  }, [setNodes]);

  const onAddSlot = useCallback((nodeId: string) => {
    const slotId = `slot-${Date.now()}`;
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const prev = (n.data.slots as SlotData[] | undefined) ?? [];
      return { ...n, data: { ...n.data, slots: [...prev, { slotId, displayNome: null, employeeNome: null, employeeChapa: null, situacao: null, comment: null }] } };
    }));
  }, [setNodes]);

  const onRemoveSlot = useCallback((nodeId: string, slotId: string) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const prev = (n.data.slots as SlotData[] | undefined) ?? [];
      return { ...n, data: { ...n.data, slots: prev.filter((s) => s.slotId !== slotId) } };
    }));
  }, [setNodes]);

  const onSlotNomeChange = useCallback((nodeId: string, slotId: string, val: string) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const prev = (n.data.slots as SlotData[] | undefined) ?? [];
      return { ...n, data: { ...n.data, slots: prev.map((s) => s.slotId === slotId ? { ...s, displayNome: val } : s) } };
    }));
  }, [setNodes]);

  const onSlotCommentChange = useCallback((nodeId: string, slotId: string, val: string) => {
    setNodes((nds) => nds.map((n) => {
      if (n.id !== nodeId) return n;
      const prev = (n.data.slots as SlotData[] | undefined) ?? [];
      return { ...n, data: { ...n.data, slots: prev.map((s) => s.slotId === slotId ? { ...s, comment: val || null } : s) } };
    }));
  }, [setNodes]);

  const changeNodeColor = useCallback((color: string | null) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => n.id === selectedNodeId ? { ...n, data: { ...n.data, color } } : n));
  }, [selectedNodeId, setNodes]);

  // ── Pesquisa ─────────────────────────────────────────────────────────────
  const searchActive = searchQuery.trim().length > 0;
  const matchingIds = searchActive
    ? new Set(nodes.filter((n) => nodeMatchesSearch(n.data, searchQuery)).map((n) => n.id))
    : null;

  const nodesWithCallbacks: OrgFlowNode[] = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      ...(canEdit ? { onLabelChange, onNomeChange, onAddSlot, onRemoveSlot, onSlotNomeChange } : {}),
      ...((canEdit || canEditComments) ? { onCommentChange, onSlotCommentChange } : {}),
      searchActive,
      searchMatch: matchingIds ? matchingIds.has(n.id) : true,
    },
  }));

  // ── Seleção / delete ─────────────────────────────────────────────────────
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedIsChild = !!(selectedNode as any)?.parentId && !selectedNode?.data.isGroup;
  const selectedColor = (selectedNode?.data.color as string | null | undefined) ?? null;

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setShowColorPicker(false);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setShowColorPicker(false);
  }, []);

  const deleteSelected = useCallback(() => {
    if (selectedNodeId) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
      setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
      setSelectedNodeId(null);
    }
    if (selectedEdgeId) {
      setEdges((eds) => eds.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
    }
  }, [selectedNodeId, selectedEdgeId, setNodes, setEdges]);

  // ── Grupos / redimensionamento ────────────────────────────────────────────
  const applyGroupResize = useCallback((nds: OrgFlowNode[]): OrgFlowNode[] => {
    const NODE_W = 200, NODE_H = 90, PAD = 20;
    return nds.map((n) => {
      if (!n.data.isGroup) return n;
      const children = nds.filter((c) => (c as any).parentId === n.id);
      if (children.length === 0) return n;
      let maxRight = 300, maxBottom = 200;
      for (const c of children) {
        maxRight = Math.max(maxRight, c.position.x + NODE_W + PAD);
        maxBottom = Math.max(maxBottom, c.position.y + NODE_H + PAD);
      }
      return { ...n, style: { ...n.style, width: maxRight, height: maxBottom } };
    });
  }, []);

  const ejectNode = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => {
      const node = nds.find((n) => n.id === selectedNodeId);
      if (!node || !(node as any).parentId) return nds;
      const parent = nds.find((n) => n.id === (node as any).parentId);
      const absX = (parent?.position.x ?? 0) + node.position.x + 30;
      const absY = (parent?.position.y ?? 0) + node.position.y + 30;
      const ejected = nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const { parentId: _p, extent: _e, ...rest } = n as any;
        return { ...rest, position: { x: absX, y: absY } };
      });
      return applyGroupResize(ejected);
    });
  }, [selectedNodeId, setNodes, applyGroupResize]);

  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: OrgFlowNode) => {
    if (!canEdit || draggedNode.data.isGroup) return;
    setNodes((nds) => {
      const parentId = (draggedNode as any).parentId as string | undefined;
      if (parentId) {
        const parent = nds.find((n) => n.id === parentId);
        if (parent) {
          const gw = (parent.style?.width as number) ?? 500;
          const gh = (parent.style?.height as number) ?? 360;
          const { x, y } = draggedNode.position;
          if (x < -60 || y < -60 || x > gw - 40 || y > gh - 40) {
            const absX = parent.position.x + x;
            const absY = parent.position.y + y;
            const ejected = nds.map((n) => {
              if (n.id !== draggedNode.id) return n;
              const { parentId: _p, extent: _e, ...rest } = n as any;
              return { ...rest, position: { x: absX, y: absY } };
            });
            return applyGroupResize(ejected);
          }
        }
        return applyGroupResize(nds);
      }
      const centerX = draggedNode.position.x + 82;
      const centerY = draggedNode.position.y + 45;
      const targetGroup = nds.find((n) => {
        if (!n.data.isGroup) return false;
        const gx = n.position.x, gy = n.position.y;
        const gw = (n.style?.width as number) ?? 500;
        const gh = (n.style?.height as number) ?? 360;
        return centerX >= gx && centerX <= gx + gw && centerY >= gy && centerY <= gy + gh;
      });
      if (!targetGroup) return nds;
      const relX = Math.max(0, draggedNode.position.x - targetGroup.position.x);
      const relY = Math.max(0, draggedNode.position.y - targetGroup.position.y);
      const withParent = nds.map((n) =>
        n.id !== draggedNode.id ? n : { ...n, parentId: targetGroup.id, position: { x: relX, y: relY } }
      );
      return applyGroupResize([...withParent.filter((n) => n.data.isGroup), ...withParent.filter((n) => !n.data.isGroup)]);
    });
  }, [canEdit, applyGroupResize, setNodes]);

  // ── Adicionar nós ─────────────────────────────────────────────────────────
  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`;
    setNodes((nds) => [...nds, {
      id, type: "orgNode",
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 },
      data: { label: "Nova Posição", displayNome: null, employeeNome: null, employeeChapa: null, color: null },
    }]);
    setPendingFitNode(id);
  }, [setNodes]);

  const addPositionGroup = useCallback(() => {
    const id = `posgroup-${Date.now()}`;
    setNodes((nds) => [...nds, {
      id, type: "positionGroup",
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 },
      data: {
        label: "NOVA FUNÇÃO",
        displayNome: null, employeeNome: null, employeeChapa: null,
        color: null,
        slots: [{ slotId: `slot-${Date.now()}`, displayNome: null, employeeNome: null, employeeChapa: null, situacao: null, comment: null }],
      },
    }]);
    setPendingFitNode(id);
  }, [setNodes]);

  const addGroupNode = useCallback(() => {
    const id = `group-${Date.now()}`;
    setNodes((nds) => [{
      id, type: "carteiraGroup",
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 50 },
      style: { width: 500, height: 360 },
      data: { label: "Nova Carteira", displayNome: "0 colaboradores", isGroup: true, employeeNome: null, employeeChapa: null, color: null },
    }, ...nds]);
    setPendingFitNode(id);
  }, [setNodes]);

  const addSectionLabel = useCallback(() => {
    const id = `section-${Date.now()}`;
    setNodes((nds) => [...nds, {
      id, type: "sectionLabel",
      position: { x: 250 + Math.random() * 150, y: 80 + Math.random() * 60 },
      data: { label: "NOME DA BASE", displayNome: null, employeeNome: null, employeeChapa: null, color: null },
    }]);
    setPendingFitNode(id);
  }, [setNodes]);

  // ── Salvar ────────────────────────────────────────────────────────────────
  const saveLayout = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}/orgNodes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }, [projectId, nodes, edges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={canEdit ? onNodesChange : undefined}
        onEdgesChange={canEdit ? onEdgesChange : undefined}
        onConnect={canEdit ? (c) => { if (canEdit) setEdges((eds) => addEdge({ ...c, ...DEFAULT_EDGE }, eds)); } : undefined}
        onNodeClick={onNodeClick}
        onNodeDragStop={canEdit ? onNodeDragStop : undefined}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable={canEdit}
        nodesConnectable={canEdit}
        elementsSelectable={true}
        deleteKeyCode={null}
        defaultEdgeOptions={DEFAULT_EDGE}
        connectionLineStyle={{ stroke: "#6366f1", strokeWidth: 2, strokeDasharray: "5,5" }}
        snapToGrid={snapEnabled}
        snapGrid={SNAP_GRID}
        proOptions={{ hideAttribution: true }}
      >
        {snapEnabled
          ? <Background variant={BackgroundVariant.Lines} gap={20} size={1} color="#e2e8f0" />
          : <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />}

        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const c = (n.data as OrgNodeData).color as string | null;
            if (c) return c;
            return (n.data as OrgNodeData).isGroup ? "#64748b" : "#cbd5e1";
          }}
          style={{ background: "#f8fafc" }}
        />

        <SearchPanel nodes={nodes} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        <FitNewNode nodeId={pendingFitNode} onDone={() => setPendingFitNode(null)} />

        {canEdit && (
          <Panel position="top-right" className="flex flex-col gap-2 items-end">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={addNode}>
                <Plus className="mr-1 h-4 w-4" /> Nova caixa
              </Button>
              <Button size="sm" variant="outline" onClick={addPositionGroup} className="border-indigo-400 text-indigo-600 hover:bg-indigo-50">
                <List className="mr-1 h-4 w-4" /> Lista de posições
              </Button>
              <Button size="sm" variant="outline" onClick={addGroupNode} className="border-slate-400 text-slate-600 hover:bg-slate-50">
                <FolderPlus className="mr-1 h-4 w-4" /> Nova carteira
              </Button>
              <Button size="sm" variant="outline" onClick={addSectionLabel} className="border-slate-400 text-slate-600 hover:bg-slate-50">
                <Tag className="mr-1 h-4 w-4" /> Nova seção/base
              </Button>
              <Button size="sm" variant={snapEnabled ? "default" : "outline"}
                onClick={() => setSnapEnabled((v) => !v)}
                className={snapEnabled ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                title={snapEnabled ? "Desativar grade" : "Ativar grade"}>
                {snapEnabled ? <Grid2x2Check className="mr-1 h-4 w-4" /> : <Grid2x2 className="mr-1 h-4 w-4" />}
                Grade {snapEnabled ? "ON" : "OFF"}
              </Button>
              {selectedIsChild && (
                <Button size="sm" variant="outline" onClick={ejectNode} className="border-orange-400 text-orange-600 hover:bg-orange-50">
                  <LogOut className="mr-1 h-4 w-4" /> Tirar do container
                </Button>
              )}
              {(selectedNodeId || selectedEdgeId) && (
                <Button size="sm" variant="destructive" onClick={deleteSelected}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  {selectedEdgeId ? "Excluir linha" : "Excluir caixa"}
                </Button>
              )}
              <Button size="sm" onClick={saveLayout} disabled={saving}>
                {saved ? <><Check className="mr-1 h-4 w-4 text-green-300" /> Salvo</> : <><Save className="mr-1 h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}</>}
              </Button>
            </div>

            {selectedNodeId && (
              <div className="bg-white/95 border rounded-lg shadow-md p-3 w-full">
                <button onClick={() => setShowColorPicker((v) => !v)} className="flex items-center gap-2 w-full text-left">
                  <Palette className="h-4 w-4 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Cor do acento</span>
                  {selectedColor && <span className="ml-auto w-4 h-4 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: selectedColor }} />}
                  <span className="text-[10px] text-slate-400">{showColorPicker ? "▲" : "▼"}</span>
                </button>
                {showColorPicker && (
                  <div className="mt-2 grid grid-cols-8 gap-1.5">
                    {COLOR_PALETTE.map((c) =>
                      c.value === null ? (
                        <button key="default" onClick={() => changeNodeColor(null)} title="Padrão"
                          className={`w-6 h-6 rounded-md border-2 border-dashed border-slate-300 bg-white transition-all hover:scale-110 ${selectedColor === null ? "ring-2 ring-offset-1 ring-slate-500 scale-110" : ""}`} />
                      ) : (
                        <button key={c.value} onClick={() => changeNodeColor(c.value)} title={c.label}
                          style={{ backgroundColor: c.value }}
                          className={`w-6 h-6 rounded-md transition-all hover:scale-110 ${selectedColor === c.value ? "ring-2 ring-offset-1 ring-slate-700 scale-110" : ""}`} />
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white/90 border text-[11px] text-slate-500 rounded-md px-3 py-2 shadow-sm max-w-[300px] leading-relaxed">
              <span className="font-semibold text-slate-700">Como editar:</span><br />
              • <strong>Lista de posições:</strong> mesma função, várias pessoas numa caixa<br />
              • <strong>Cor:</strong> selecione uma caixa e escolha a cor<br />
              • <strong>Entrar no container:</strong> arraste a caixa por cima do container<br />
              • <strong>Cargo/Nome:</strong> clique duplo no texto<br />
              • <strong>Conectar:</strong> arraste da bolinha inferior<br />
              • <strong>Comentário:</strong> ícone <MessageSquare className="inline h-3 w-3" /> na caixa
            </div>
          </Panel>
        )}

        {!canEdit && canEditComments && (
          <Panel position="top-right">
            <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 text-xs text-amber-700 shadow-sm">
              Clique no <MessageSquare className="inline h-3 w-3" /> para editar comentários
            </div>
          </Panel>
        )}

        {!canEdit && !canEditComments && (
          <Panel position="top-right">
            <div className="bg-white/90 border rounded-md px-3 py-1.5 text-xs text-slate-500 shadow-sm">
              Modo visualização
            </div>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}
