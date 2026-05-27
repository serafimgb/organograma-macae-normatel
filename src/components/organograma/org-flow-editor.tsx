"use client";

import { useCallback, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
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
import { Plus, Save, Check, Trash2, MessageSquare, X, FolderPlus, LogOut } from "lucide-react";

interface OrgNodeData extends Record<string, unknown> {
  label: string;
  displayNome: string | null;
  employeeNome: string | null;
  employeeChapa: string | null;
  situacao?: string | null;
  comment?: string | null;
  isGroup?: boolean;
  onLabelChange?: (id: string, val: string) => void;
  onNomeChange?: (id: string, val: string) => void;
  onCommentChange?: (id: string, val: string) => void;
}

type OrgFlowNode = Node<OrgNodeData>;

const SITUACAO_STYLE: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  ATIVO:     { border: "#22c55e", bg: "#f0fdf4", badge: "#16a34a", text: "Ativo" },
  AFASTADO:  { border: "#f97316", bg: "#fff7ed", badge: "#ea580c", text: "Afastado" },
  DESLIGADO: { border: "#94a3b8", bg: "#f8fafc", badge: "#64748b", text: "Desligado" },
  FERIAS:    { border: "#3b82f6", bg: "#eff6ff", badge: "#2563eb", text: "Férias" },
  LICENCA:   { border: "#a855f7", bg: "#faf5ff", badge: "#9333ea", text: "Licença" },
};

function InlineEdit({
  value,
  onSave,
  className,
  inputClassName,
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  inputClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const ref = useRef<HTMLInputElement>(null);

  function start(e: React.MouseEvent) {
    e.stopPropagation();
    setVal(value);
    setEditing(true);
    setTimeout(() => ref.current?.select(), 10);
  }

  function commit() {
    if (val.trim()) onSave(val.trim());
    setEditing(false);
  }

  function keyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    if (e.key === "Escape") setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={keyDown}
        onClick={(e) => e.stopPropagation()}
        autoFocus
        className={inputClassName ?? "w-full text-center bg-transparent border-b border-white/50 outline-none text-white text-[10px] font-semibold uppercase tracking-wide"}
      />
    );
  }

  return (
    <span className={className} onDoubleClick={start} title="Clique duplo para editar">
      {value}
    </span>
  );
}

function CommentSection({
  comment,
  onSave,
}: {
  comment: string | null | undefined;
  onSave: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(comment ?? "");

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setVal(comment ?? "");
    setOpen((o) => !o);
  }

  function save(e: React.MouseEvent) {
    e.stopPropagation();
    onSave(val);
    setOpen(false);
  }

  function keyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="border-t border-slate-200 px-2 py-1" onClick={(e) => e.stopPropagation()}>
      {!open ? (
        <button
          onClick={toggle}
          className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-slate-600 w-full"
        >
          <MessageSquare className="h-3 w-3 shrink-0" />
          {comment ? (
            <span className="truncate text-left text-slate-500">{comment}</span>
          ) : (
            <span>Adicionar comentário…</span>
          )}
        </button>
      ) : (
        <div className="space-y-1">
          <textarea
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={keyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder="Comentário para gestores…"
            rows={3}
            autoFocus
            className="w-full text-[10px] text-slate-700 border border-slate-200 rounded p-1 resize-none outline-none focus:border-blue-400"
          />
          <div className="flex gap-1 justify-end">
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="text-[9px] text-slate-400 hover:text-slate-600 px-1"
            >
              <X className="h-3 w-3" />
            </button>
            <button
              onClick={save}
              className="text-[9px] bg-emerald-600 text-white rounded px-2 py-0.5 hover:bg-emerald-700"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrgNodeComponent({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const isVaga = !data.employeeNome && !data.displayNome;
  const sit = data.situacao && SITUACAO_STYLE[data.situacao] ? data.situacao : "ATIVO";
  const style = isVaga
    ? { border: "#fbbf24", bg: "#fffbeb", badge: "#d97706", text: "Vaga" }
    : SITUACAO_STYLE[sit];

  const displayName = data.displayNome || data.employeeNome;
  const canEditInline = !!data.onLabelChange;

  const handleStyle = {
    background: style.border,
    border: "2px solid white",
    width: 12,
    height: 12,
    borderRadius: "50%",
  };

  return (
    <>
      <Handle type="target" position={Position.Top} style={handleStyle} />

      <div
        style={{
          borderColor: selected ? "#6366f1" : style.border,
          backgroundColor: style.bg,
          borderStyle: isVaga ? "dashed" : "solid",
          boxShadow: selected
            ? "0 0 0 2px #6366f1, 0 4px 12px rgba(0,0,0,0.15)"
            : "0 2px 8px rgba(0,0,0,0.10)",
        }}
        className="min-w-[190px] max-w-[230px] rounded-lg border-2 overflow-hidden font-sans"
      >
        {/* Header — cargo (editável) */}
        <div
          style={{ backgroundColor: isVaga ? "#f59e0b" : "#2d7a2d" }}
          className="px-3 py-2 text-center"
        >
          {canEditInline ? (
            <InlineEdit
              value={data.label}
              onSave={(v) => data.onLabelChange!(id, v)}
              className="text-white text-[10px] font-semibold tracking-wide uppercase leading-tight block cursor-text hover:opacity-80"
            />
          ) : (
            <span className="text-white text-[10px] font-semibold tracking-wide uppercase leading-tight block">
              {data.label}
            </span>
          )}
        </div>

        {/* Corpo — nome e situação */}
        <div className="px-3 py-2 text-center">
          {isVaga ? (
            <span className="text-[11px] font-bold text-amber-700 tracking-wider">VAGA EM ABERTO</span>
          ) : (
            <>
              {canEditInline ? (
                <InlineEdit
                  value={displayName ?? ""}
                  onSave={(v) => data.onNomeChange!(id, v)}
                  className="text-[11px] font-bold text-slate-800 leading-tight cursor-text hover:opacity-70 block"
                  inputClassName="w-full text-center bg-slate-50 border-b border-slate-300 outline-none text-[11px] font-bold text-slate-800"
                />
              ) : (
                <div className="text-[11px] font-bold text-slate-800 leading-tight">{displayName}</div>
              )}
              {data.employeeChapa && (
                <div className="text-[9px] text-slate-400 mt-0.5 font-mono">#{data.employeeChapa}</div>
              )}
              {data.situacao && data.situacao !== "ATIVO" && (
                <span
                  style={{ backgroundColor: style.badge }}
                  className="mt-1 inline-block text-white text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                >
                  {style.text}
                </span>
              )}
            </>
          )}
        </div>

        {/* Comentários */}
        {canEditInline && (
          <CommentSection
            comment={data.comment}
            onSave={(v) => data.onCommentChange!(id, v)}
          />
        )}
        {!canEditInline && data.comment && (
          <div className="border-t border-slate-200 px-2 py-1 flex items-start gap-1">
            <MessageSquare className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
            <span className="text-[9px] text-slate-500 leading-tight">{data.comment}</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={handleStyle} />
    </>
  );
}

function CarteiraGroupNode({ id, data, selected }: { id: string; data: OrgNodeData; selected: boolean }) {
  const canEdit = !!data.onLabelChange;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: 14,
        border: `2px solid ${selected ? "#6366f1" : "#166534"}`,
        overflow: "hidden",
        boxShadow: selected
          ? "0 0 0 2px #6366f1, 0 6px 24px rgba(0,0,0,0.18)"
          : "0 4px 16px rgba(0,0,0,0.12)",
        backgroundColor: "rgba(240, 253, 244, 0.55)", // emerald-50 semi-transparente
        backdropFilter: "blur(2px)",
      }}
    >
      {/* Header bar */}
      <div
        style={{ backgroundColor: "#166534", height: 56 }}
        className="px-4 flex items-center justify-between gap-3"
      >
        <div className="flex-1 min-w-0">
          {canEdit ? (
            <InlineEdit
              value={data.label}
              onSave={(v) => data.onLabelChange!(id, v)}
              className="text-white text-[12px] font-bold tracking-widest uppercase cursor-text hover:opacity-80 block truncate"
            />
          ) : (
            <span className="text-white text-[12px] font-bold tracking-widest uppercase block truncate">
              {data.label}
            </span>
          )}
        </div>
        {data.displayNome && (
          <span className="shrink-0 bg-emerald-500 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap">
            {canEdit ? (
              <InlineEdit
                value={data.displayNome}
                onSave={(v) => data.onNomeChange!(id, v)}
                className="text-white text-[11px] font-semibold cursor-text hover:opacity-80"
                inputClassName="bg-transparent border-b border-white/50 outline-none text-[11px] font-semibold text-white w-24 text-center"
              />
            ) : (
              data.displayNome
            )}
          </span>
        )}
      </div>
      {/* Body — transparente, os filhos aparecem aqui */}
    </div>
  );
}

const nodeTypes = { orgNode: OrgNodeComponent, carteiraGroup: CarteiraGroupNode };

interface OrgFlowEditorProps {
  projectId: string;
  initialNodes: OrgFlowNode[];
  initialEdges: Edge[];
  canEdit: boolean;
}

const DEFAULT_EDGE = {
  type: "smoothstep",
  animated: false,
  style: { stroke: "#475569", strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
};

export function OrgFlowEditor({ projectId, initialNodes, initialEdges, canEdit }: OrgFlowEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<OrgFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const onLabelChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: val } } : n));
  }, [setNodes]);

  const onNomeChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, displayNome: val } } : n));
  }, [setNodes]);

  const onCommentChange = useCallback((nodeId: string, val: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, comment: val || null } } : n));
  }, [setNodes]);

  // Nó atualmente selecionado e se ele é filho de um container
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedIsChild = !!(selectedNode as any)?.parentId && !selectedNode?.data.isGroup;

  const nodesWithCallbacks: OrgFlowNode[] = canEdit
    ? nodes.map((n) => ({
        ...n,
        data: { ...n.data, onLabelChange, onNomeChange, onCommentChange },
      }))
    : nodes;

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
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
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

  // Recalcula tamanho de todos os containers com base nas posições relativas dos filhos
  const applyGroupResize = useCallback((nds: OrgFlowNode[]): OrgFlowNode[] => {
    const NODE_W = 220, NODE_H = 155, PAD = 20;
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

  // Ejeta o nó selecionado do container — converte posição relativa em absoluta
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

  // Ao soltar um nó: entra em container se sobreposto; sai se arrastado para fora
  const onNodeDragStop = useCallback((_: React.MouseEvent, draggedNode: OrgFlowNode) => {
    if (!canEdit || draggedNode.data.isGroup) return;

    setNodes((nds) => {
      const parentId = (draggedNode as any).parentId as string | undefined;

      if (parentId) {
        // Nó filho: verifica se foi arrastado para fora do container
        const parent = nds.find((n) => n.id === parentId);
        if (parent) {
          const gw = (parent.style?.width as number) ?? 500;
          const gh = (parent.style?.height as number) ?? 360;
          const { x, y } = draggedNode.position;
          // Se saiu dos limites → ejeta automaticamente
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

      // Nó livre: verifica se o centro caiu dentro de algum container
      const centerX = draggedNode.position.x + 110;
      const centerY = draggedNode.position.y + 75;

      const targetGroup = nds.find((n) => {
        if (!n.data.isGroup) return false;
        const gx = n.position.x, gy = n.position.y;
        const gw = (n.style?.width as number) ?? 500;
        const gh = (n.style?.height as number) ?? 360;
        return centerX >= gx && centerX <= gx + gw && centerY >= gy && centerY <= gy + gh;
      });

      if (!targetGroup) return nds;

      // Converte posição absoluta → relativa ao container (sem extent para permitir arrastar para fora)
      const relX = Math.max(0, draggedNode.position.x - targetGroup.position.x);
      const relY = Math.max(0, draggedNode.position.y - targetGroup.position.y);

      const withParent = nds.map((n) =>
        n.id !== draggedNode.id ? n : {
          ...n,
          parentId: targetGroup.id,
          position: { x: relX, y: relY },
        }
      );

      const groups = withParent.filter((n) => n.data.isGroup);
      const others = withParent.filter((n) => !n.data.isGroup);
      return applyGroupResize([...groups, ...others]);
    });
  }, [canEdit, applyGroupResize, setNodes]);

  const addNode = useCallback(() => {
    const id = `node-${Date.now()}`;
    const newNode: OrgFlowNode = {
      id,
      type: "orgNode",
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 100 },
      data: {
        label: "Nova Posição",
        displayNome: null,
        employeeNome: null,
        employeeChapa: null,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes]);

  const addGroupNode = useCallback(() => {
    const id = `group-${Date.now()}`;
    const newNode: OrgFlowNode = {
      id,
      type: "carteiraGroup",
      position: { x: 200 + Math.random() * 100, y: 100 + Math.random() * 50 },
      style: { width: 500, height: 360 },
      data: {
        label: "Nova Carteira",
        displayNome: "0 colaboradores",
        isGroup: true,
        employeeNome: null,
        employeeChapa: null,
      },
    };
    // Grupos devem aparecer antes dos filhos no array para o ReactFlow renderizar corretamente
    setNodes((nds) => [newNode, ...nds]);
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
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => {
            const d = n.data as OrgNodeData;
            if (d.isGroup) return "#15803d";
            return d.situacao && SITUACAO_STYLE[d.situacao] ? SITUACAO_STYLE[d.situacao].border : "#2d7a2d";
          }}
          style={{ background: "#f8fafc" }}
        />

        {canEdit && (
          <Panel position="top-right" className="flex flex-col gap-2 items-end">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={addNode}>
                <Plus className="mr-1 h-4 w-4" /> Nova caixa
              </Button>
              <Button size="sm" variant="outline" onClick={addGroupNode} className="border-emerald-600 text-emerald-700 hover:bg-emerald-50">
                <FolderPlus className="mr-1 h-4 w-4" /> Nova carteira
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
                {saved ? (
                  <><Check className="mr-1 h-4 w-4 text-green-300" /> Salvo</>
                ) : (
                  <><Save className="mr-1 h-4 w-4" /> {saving ? "Salvando…" : "Salvar"}</>
                )}
              </Button>
            </div>

            <div className="bg-white/90 border text-[11px] text-slate-500 rounded-md px-3 py-2 shadow-sm max-w-[260px] leading-relaxed">
              <span className="font-semibold text-slate-700">Como editar:</span><br />
              • <strong>Entrar no container:</strong> arraste a caixa por cima do container verde e solte<br />
              • <strong>Sair do container:</strong> arraste para fora dos limites, ou selecione e clique "Tirar do container"<br />
              • <strong>Cargo/Nome:</strong> clique duplo no texto<br />
              • <strong>Comentário:</strong> clique no ícone de mensagem<br />
              • <strong>Conectar:</strong> arraste da bolinha inferior
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
