"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";

type Situacao = "ATIVO" | "DESLIGADO" | "AFASTADO" | "FERIAS" | "LICENCA";

export interface EmployeeFormData {
  id: string;
  chapa: string;
  nome: string;
  funcao: string;
  carteiraId: string | null;
  baseId: string | null;
  situacao: Situacao;
  admissao: string;
  demissao: string | null;
  cpf: string | null;
}

interface Props {
  projectId: string;
  carteiras: { id: string; name: string }[];
  bases: { id: string; name: string }[];
  funcoes: { id: string; name: string }[];
  employee?: EmployeeFormData;
  onSaved: () => void;
}

const SITUACOES: { value: Situacao; label: string }[] = [
  { value: "ATIVO", label: "Ativo" },
  { value: "DESLIGADO", label: "Desligado" },
  { value: "AFASTADO", label: "Afastado" },
  { value: "FERIAS", label: "Férias" },
  { value: "LICENCA", label: "Licença" },
];

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

export function EmployeeFormDialog({ projectId, carteiras, bases, funcoes, employee, onSaved }: Props) {
  const isEdit = !!employee;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [chapa, setChapa] = useState("");
  const [nome, setNome] = useState("");
  const [funcaoName, setFuncaoName] = useState("");
  const [carteiraId, setCarteiraId] = useState("");
  const [baseId, setBaseId] = useState("");
  const [situacao, setSituacao] = useState<Situacao>("ATIVO");
  const [admissao, setAdmissao] = useState("");
  const [demissao, setDemissao] = useState("");
  const [cpf, setCpf] = useState("");

  useEffect(() => {
    if (open) {
      setChapa(employee?.chapa ?? "");
      setNome(employee?.nome ?? "");
      setFuncaoName(employee?.funcao ?? "");
      setCarteiraId(employee?.carteiraId ?? "");
      setBaseId(employee?.baseId ?? "");
      setSituacao(employee?.situacao ?? "ATIVO");
      setAdmissao(toDateInput(employee?.admissao));
      setDemissao(toDateInput(employee?.demissao));
      setCpf(employee?.cpf ?? "");
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!nome.trim() || !funcaoName.trim() || !admissao) {
      setError("Nome, função e admissão são obrigatórios");
      return;
    }
    if (!isEdit && !chapa.trim()) {
      setError("Chapa é obrigatória");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEdit
        ? `/api/projects/${projectId}/employees/${employee!.id}`
        : `/api/projects/${projectId}/employees`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chapa: chapa.trim().toUpperCase(),
          nome: nome.trim(),
          funcaoName: funcaoName.trim(),
          carteiraId: carteiraId || null,
          baseId: baseId || null,
          situacao,
          admissao,
          demissao: demissao || null,
          cpf: cpf.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao salvar");
      }
      setOpen(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo colaborador
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Editar — ${employee!.nome}` : "Novo colaborador"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Chapa {!isEdit && "*"}</label>
              <Input
                value={chapa}
                onChange={(e) => setChapa(e.target.value)}
                disabled={isEdit}
                placeholder="00123"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">CPF</label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Nome *</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Função *</label>
            <Input
              list="efetivo-funcoes-list"
              value={funcaoName}
              onChange={(e) => setFuncaoName(e.target.value)}
              placeholder="Digite ou selecione a função"
            />
            <datalist id="efetivo-funcoes-list">
              {funcoes.map((f) => (
                <option key={f.id} value={f.name} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Carteira</label>
              <Select
                value={carteiraId || "_none_"}
                onValueChange={(v) => setCarteiraId(v === "_none_" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhuma</SelectItem>
                  {carteiras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Base</label>
              <Select
                value={baseId || "_none_"}
                onValueChange={(v) => setBaseId(v === "_none_" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none_">Nenhuma</SelectItem>
                  {bases.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Situação *</label>
            <Select value={situacao} onValueChange={(v) => setSituacao(v as Situacao)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUACOES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Admissão *</label>
              <Input type="date" value={admissao} onChange={(e) => setAdmissao(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Demissão</label>
              <Input type="date" value={demissao} onChange={(e) => setDemissao(e.target.value)} />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive mt-3">{error}</p>}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
