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
  type Connection,
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
import { Plus, Save, Check, Trash2, MessageSquare, X, FolderPlus, LogOut, Search, Grid2x2, Grid2x2Check, Tag, Palette } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgNodeData extends Record<string, unknown> {
  label: string;
  displayNome: string | null;
  employeeNome: string | null;
  employeeChapa: string | null;
  situacao?: string | null;
  comment?: string | null;
  isGroup?: boolean;
  color?: string | null;
  searchActive?: boolean;
  searchMatch?: boolean;
  onLabelChange?: (id: string, val: string) => void;
  onNomeChange?: (id: string, val: string) => void;
  onCommentChange?: (id: string, val: string) => void;
}

type OrgFlowNode = Node<OrgNodeData>;

// ─── Color palette ────────────────────────────────────────────────────────────

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

function nodeMatchesSearch(data: OrgNodeData, query: string): boolean {
  const q = query.toLowerCase();
  return (
    !!data.label?.toLowerCase().includes(q) ||
    !!data.displayNome?.toLowerCase().includes(q) ||
    !!data.employeeNome?.toLowerCase().includes(q)
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

// ─── Comment section ──────────────────────────────────────────────────────────

function CommentSection({ comment, onSave }: { comment: string | null | undefined; onSave: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(comment ?? "");
  function toggle(e: React.MouseEvent) { e.stopPropagation(); setVal(comment ?? ""); setOpen((o) => !o); }
  function save(e: React.MouseEvent) { e.stopPropagation(); onSave(val); setOpen(false); }
  function keyDown(e: React.KeyboardEvent) { e.stopPropagation(); if (e.key === "Escape") setOpen(false); }
  return (
    <div className="border-t border-slate-100 px-3 py-1" onClick={(e) => e.stopPropagation()}>
      {!open ? (
        <button onClick={toggle} className="flex items-center gap-1 text-[9px] text-slate-300 hover:text-slate-500 w-full">
          <MessageSquare className="h-3 w-3 shrink-0" />
          {comment ? <span className="truncate text-left text-slate-400">{comment}</span> : <span>Comentário…</span>}
        </button>
      ) : (
        <div className="space-y-1 py-1">
          <textarea value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={keyDown} onClick={(e) => e.stopPropagation()}
            placeholder="Comentário para gestores…" rows={3} autoFocus
            className="w-full text-[10px] text-slate-700 border border-slate-200 rounded p-1 resize-none outline-none focus:border-blue-400" />
          <div className="flex gap-1 justify-end">
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); }} className="text-[9px] text-slate-400 hover:text-slate-600 px-1"><X className="h-3 w-3" /></button>
            <button onClick={save} className="text-[9px] bg-slate-700 text-white rounded px-2 py-0.5 hover:bg-slate-800">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrgNode: função em destaque + nome secundário ────────────────────────────

function OrgNodeComponent({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const isVaga = !data.employeeNome && !data.displayNome;
  const sit = data.situacao ?? "ATIVO";
  const situStyle = SITUACAO_STYLE[sit] ?? SITUACAO_STYLE.ATIVO;
  const showStatus = !isVaga && data.situacao && data.situacao !== "ATIVO";

  const accentColor = (data.color as string | null) ?? "#94a3b8";
  const displayName = data.displayNome || data.employeeNome;
  const canEditInline = !!data.onLabelChange;
  const dimmed = data.searchActive && !data.searchMatch;
  const highlighted = data.searchActive && data.searchMatch;

  const handleStyle = { background: accentColor, border: "2px solid white", width: 10, height: 10, borderRadius: "50%" };

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />
      <div
        style={{
          width: 200,
          backgroundColor: "#ffffff",
          border: `1px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : "#e2e8f0"}`,
          borderLeft: `4px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : accentColor}`,
          boxShadow: highlighted
            ? "0 0 0 2px #fef3c7, 0 2px 8px rgba(0,0,0,0.08)"
            : selected
            ? "0 0 0 2px #e0e7ff, 0 2px 8px rgba(0,0,0,0.08)"
            : "0 1px 4px rgba(0,0,0,0.06)",
          borderRadius: 6,
          overflow: "hidden",
          opacity: dimmed ? 0.25 : 1,
          transition: "opacity 0.15s",
        }}
        className="font-sans"
      >
        {/* Cargo / Função — elemento principal */}
        <div className="px-3 pt-2.5 pb-1.5">
          {canEditInline
            ? <InlineEdit value={data.label} onSave={(v) => data.onLabelChange!(id, v)}
                className="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight block cursor-text hover:text-slate-600"
                inputClassName="w-full bg-transparent border-b border-slate-300 outline-none text-[11px] font-bold text-slate-800 uppercase tracking-wide"
              />
            : <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wide leading-tight block">{data.label}</span>
          }
        </div>

        <div style={{ height: 1, backgroundColor: "#f1f5f9", margin: "0 12px" }} />

        {/* Nome — elemento secundário */}
        <div className="px-3 pt-1.5 pb-2">
          {isVaga ? (
            <span className="text-[10px] font-semibold text-amber-600 tracking-wide">VAGA EM ABERTO</span>
          ) : (
            <div className="flex items-start gap-1">
              <div className="flex-1 min-w-0">
                {canEditInline
                  ? <InlineEdit value={displayName ?? ""} onSave={(v) => data.onNomeChange!(id, v)}
                      className="text-[10px] text-slate-500 leading-tight block cursor-text hover:text-slate-700"
                      inputClassName="w-full bg-transparent border-b border-slate-200 outline-none text-[10px] text-slate-500"
                    />
                  : <div className="text-[10px] text-slate-500 leading-tight">{displayName}</div>
                }
                {data.employeeChapa && (
                  <div className="text-[9px] text-slate-400 mt-0.5 font-mono">#{data.employeeChapa}</div>
                )}
              </div>
              {showStatus && (
                <span style={{ backgroundColor: situStyle.dot }}
                  className="shrink-0 text-white text-[8px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 whitespace-nowrap">
                  {situStyle.text}
                </span>
              )}
            </div>
          )}
        </div>

        {canEditInline && <CommentSection comment={data.comment} onSave={(v) => data.onCommentChange!(id, v)} />}
        {!canEditInline && data.comment && (
          <div className="border-t border-slate-100 px-3 py-1 flex items-center gap-1">
            <MessageSquare className="h-3 w-3 text-slate-300 shrink-0" />
            <span className="text-[9px] text-slate-400 truncate">{data.comment}</span>
          </div>
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
    <div
      style={{
        width: "100%", height: "100%", borderRadius: 10,
        border: `2px solid ${selected ? "#6366f1" : color}`,
        overflow: "hidden",
        boxShadow: selected ? "0 0 0 2px #e0e7ff, 0 6px 24px rgba(0,0,0,0.12)" : "0 4px 16px rgba(0,0,0,0.08)",
        backgroundColor: "rgba(248, 250, 252, 0.75)",
        backdropFilter: "blur(2px)",
        opacity: dimmed ? 0.3 : 1,
        transition: "opacity 0.15s",
      }}
    >
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
      <div
        style={{
          backgroundColor: color,
          border: `2px solid ${highlighted ? "#f59e0b" : selected ? "#6366f1" : color}`,
          boxShadow: highlighted ? "0 0 0 3px #fbbf24, 0 4px 16px rgba(0,0,0,0.15)"
            : selected ? "0 0 0 2px #6366f1, 0 4px 16px rgba(0,0,0,0.15)"
            : "0 3px 12px rgba(0,0,0,0.12)",
          opacity: dimmed ? 0.25 : 1,
          transition: "opacity 0.15s",
          minWidth: 200,
          borderRadius: 8,
          padding: "10px 24px",
          textAlign: "center",
        }}
      >
        {canEditInline
          ? <InlineEdit value={data.label} onSave={(v) => data.onLabelChange!(id, v)}
              className="text-white text-sm font-bold tracking-widest uppercase cursor-text hover:opacity-80 block" />
          : <span className="text-white text-sm font-bold tracking-widest uppercase block">{data.label}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

const nodeTypes = { orgNode: OrgNodeComponent, carteiraGroup: CarteiraGroupNode, sectionLabel: SectionLabelNode };

// ─── Search panel ─────────────────────────────────────────────────────────────

function SearchPanel({ nodes, searchQuery, setSearchQuery }: {
  nodes: OrgFlowNode[]; searchQuery: string; setSearchQuery: (q: string) => void;
}) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const matches = nodes.filter((n) => nodeMatchesSearch(n.data, searchQuery));
    if (matches.length > 0) {
      fitView({ nodes: matches.map((n) => ({ id: n.id })), duration: 400, padding: 0.5, maxZoom: 1.5 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const matchCount = searchQuery.trim()
    ? nodes.filter((n) => nodeMatchesSearch(n.data, searchQuery)).length : 0;

  return (
    <Panel position="top-left">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nome ou cargo…"
            className="h-9 pl-8 pr-7 rounded-md border border-slate-200 bg-white/95 shadow-sm text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/30 w-60" />
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
}

const DEFAULT_EDGE = {
  type: "smoothstep",
  animated: false,
  style: { stroke: "#94a3b8", strokeWidth: 1.5 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
};

const SNAP_GRID: [number, number] = [20, 20];

export function OrgFlowEditor({ projectId, initialNodes, initialEdges, canEdit }: OrgFlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const onLabelChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: val } } : n));
  }, [setNodes]);

  const onNomeChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, displayNome: val } } : n));
  }, [setNodes]);

  const onCommentChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, comment: val || null } } : n));
  }, [setNodes]);

  const changeNodeColor = useCallback((color: string | null) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => n.id === selectedNodeId ? { ...n, data: { ...n.data, color } } : n));
  }, [selectedNodeId, setNodes]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedIsChild = !!(selectedNode as any)?.parentId && !selectedNode?.data.isGroup;
  const selectedColor = (selectedNode?.data.color as string | null | undefined) ?? null;

  const searchActive = searchQuery.trim().length > 0;
  const matchingIds = searchActive
    ? new Set(nodes.filter((n) => nodeMatchesSearch(n.data, searchQuery)).map((n) => n.id))
    : null;

  const nodesWithCallbacks: OrgFlowNode[] = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      ...(canEdit ? { onLabelChange, onNomeChange, onCommentChange } : {}),
      searchActive,
      searchMatch: matchingIds ? matchingIds.has(n.id) : true,
    },
  }));

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canEdit) return;
      setEdges((eds) => addEdge({ ...connection, ...DEFAULT_EDGE }, eds));
    },
    [canEdit, setEdges]
  );

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
      const centerX = draggedNode.position.x + 100;
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

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`;
    setNodes((nds) => [...nds, {
      id, type: "orgNode",
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 },
      data: { label: "Nova Posição", displayNome: null, employeeNome: null, employeeChapa: null, color: null },
    }]);
  }, [setNodes]);

  const addGroupNode = useCallback(() => {
    const id = `group-${Date.now()}`;
    setNodes((nds) => [{
      id, type: "carteiraGroup",
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 50 },
      style: { width: 500, height: 360 },
      data: { label: "Nova Carteira", displayNome: "0 colaboradores", isGroup: true, employeeNome: null, employeeChapa: null, color: null },
    }, ...nds]);
  }, [setNodes]);

  const addSectionLabel = useCallback(() => {
    const id = `section-${Date.now()}`;
    setNodes((nds) => [...nds, {
      id, type: "sectionLabel",
      position: { x: 250 + Math.random() * 150, y: 80 + Math.random() * 60 },
      data: { label: "NOME DA BASE", displayNome: null, employeeNome: null, employeeChapa: null, color: null },
    }]);
  }, [setNodes]);

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
        onConnect={canEdit ? onConnect : undefined}
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
            const d = n.data as OrgNodeData;
            const c = d.color as string | null;
            if (c) return c;
            return d.isGroup ? "#64748b" : "#cbd5e1";
          }}
          style={{ background: "#f8fafc" }}
        />

        <SearchPanel nodes={nodes} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />

        {canEdit && (
          <Panel position="top-right" className="flex flex-col gap-2 items-end">
            <div className="flex flex-wrap gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={addNode}>
                <Plus className="mr-1 h-4 w-4" /> Nova caixa
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
                  {selectedColor && (
                    <span className="ml-auto w-4 h-4 rounded-full border border-slate-200 shrink-0" style={{ backgroundColor: selectedColor }} />
                  )}
                  <span className="text-[10px] text-slate-400">{showColorPicker ? "▲" : "▼"}</span>
                </button>
                {showColorPicker && (
                  <div className="mt-2 grid grid-cols-8 gap-1.5">
                    {COLOR_PALETTE.map((c) =>
                      c.value === null ? (
                        <button key="default" onClick={() => changeNodeColor(null)} title="Padrão"
                          className={`w-6 h-6 rounded-md border-2 border-dashed border-slate-300 bg-white transition-all hover:scale-110 ${
                            selectedColor === null ? "ring-2 ring-offset-1 ring-slate-500 scale-110" : ""
                          }`}
                        />
                      ) : (
                        <button key={c.value} onClick={() => changeNodeColor(c.value)} title={c.label}
                          style={{ backgroundColor: c.value }}
                          className={`w-6 h-6 rounded-md transition-all hover:scale-110 ${
                            selectedColor === c.value ? "ring-2 ring-offset-1 ring-slate-700 scale-110" : ""
                          }`}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white/90 border text-[11px] text-slate-500 rounded-md px-3 py-2 shadow-sm max-w-[300px] leading-relaxed">
              <span className="font-semibold text-slate-700">Como editar:</span><br />
              • <strong>Nova seção/base:</strong> caixa colorida como título de área<br />
              • <strong>Cor:</strong> selecione uma caixa e escolha a cor<br />
              • <strong>Entrar no container:</strong> arraste a caixa por cima do container<br />
              • <strong>Cargo/Nome:</strong> clique duplo no texto<br />
              • <strong>Conectar:</strong> arraste da bolinha inferior<br />
              • <strong>Grade:</strong> encaixe automático ao arrastar
            </div>
          </Panel>
        )}

        {!canEdit && (
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
