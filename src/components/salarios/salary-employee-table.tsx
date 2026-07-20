"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEntranceMotion } from "@/lib/motion";

export interface SalaryEmployeeRow {
  id: string;
  nome: string;
  funcao: string;
  carteira: string | null;
  base: string | null;
  situacao: string;
  salary: number | null;
  planoSaude: number | null;
  planoOdontologico: number | null;
  seguroVida: number | null;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function SalaryEmployeeTable({
  employees,
  projectCode,
  canManage,
}: {
  employees: SalaryEmployeeRow[];
  projectCode: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const { hoverLift } = useEntranceMotion();
  const [selected, setSelected] = useState<SalaryEmployeeRow | null>(null);
  const [salary, setSalary] = useState("");
  const [planoSaude, setPlanoSaude] = useState("");
  const [planoOdontologico, setPlanoOdontologico] = useState("");
  const [seguroVida, setSeguroVida] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEmployee(emp: SalaryEmployeeRow) {
    if (!canManage) return;
    setSelected(emp);
    setSalary(emp.salary?.toString() ?? "");
    setPlanoSaude(emp.planoSaude?.toString() ?? "");
    setPlanoOdontologico(emp.planoOdontologico?.toString() ?? "");
    setSeguroVida(emp.seguroVida?.toString() ?? "");
    setError(null);
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/projects/${projectCode}/salarios/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salary: salary === "" ? null : Number(salary),
          planoSaude: planoSaude === "" ? undefined : Number(planoSaude),
          planoOdontologico: planoOdontologico === "" ? undefined : Number(planoOdontologico),
          seguroVida: seguroVida === "" ? undefined : Number(seguroVida),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Erro ao salvar");
      }
      setSelected(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <motion.div {...hoverLift}>
        <Card>
          <CardHeader>
            <CardTitle>Colaboradores</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Carteira</TableHead>
                  <TableHead>Base</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead className="text-right">Salário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((emp) => (
                  <TableRow
                    key={emp.id}
                    onClick={() => openEmployee(emp)}
                    className={canManage ? "cursor-pointer hover:bg-muted/50" : undefined}
                  >
                    <TableCell className="font-medium">{emp.nome}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.funcao}</TableCell>
                    <TableCell>{emp.carteira ?? "-"}</TableCell>
                    <TableCell>{emp.base ?? "-"}</TableCell>
                    <TableCell>
                      <Badge variant={emp.situacao === "ATIVO" ? "default" : "secondary"} className="text-xs">
                        {emp.situacao}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {emp.salary != null ? fmt(emp.salary) : <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.nome}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Salário</label>
              <Input type="number" step="0.01" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0,00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Plano Saúde</label>
                <Input type="number" step="0.01" min="0" value={planoSaude} onChange={(e) => setPlanoSaude(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Plano Odontológico</label>
                <Input type="number" step="0.01" min="0" value={planoOdontologico} onChange={(e) => setPlanoOdontologico(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Seguro de Vida</label>
              <Input type="number" step="0.01" min="0" value={seguroVida} onChange={(e) => setSeguroVida(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          {error && <p className="text-sm text-destructive mt-3">{error}</p>}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
