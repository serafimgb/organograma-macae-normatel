"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import { useEntranceMotion } from "@/lib/motion";

export interface SalaryEmployeeRow {
  id: string;
  nome: string;
  funcao: string;
  carteira: string | null;
  base: string | null;
  sindicato: string | null;
  situacao: string;
  salary: number | null;
  adicionalPercentual: number | null;
  /** salary * adicionalPercentual/100 */
  valorAdicional: number;
  /** salary + valorAdicional */
  salarioTotal: number | null;
  /** diária de alimentação resolvida (R$/dia) pro sindicato do colaborador */
  diariaRate: number;
  diasUteis: number;
  /** diariaRate * diasUteis */
  vale: number;
  /** de onde veio a diária: config exata do sindicato, valor padrão do projeto, ou nenhum configurado (R$0) */
  valeStatus: "exact" | "default" | "missing";
  planoSaude: number | null;
  planoOdontologico: number | null;
  seguroVida: number | null;
  encargos: number;
  custoTotal: number;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmt2 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const ALL = "_all_";

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
  const [adicionalPercentual, setAdicionalPercentual] = useState("");
  const [planoSaude, setPlanoSaude] = useState("");
  const [planoOdontologico, setPlanoOdontologico] = useState("");
  const [seguroVida, setSeguroVida] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [lotacaoFilter, setLotacaoFilter] = useState(ALL);
  const [carteiraFilter, setCarteiraFilter] = useState(ALL);
  const [sindicatoFilter, setSindicatoFilter] = useState(ALL);

  const lotacoes = useMemo(
    () => [...new Set(employees.map((e) => e.base).filter((v): v is string => !!v))].sort(),
    [employees]
  );
  const carteiras = useMemo(
    () => [...new Set(employees.map((e) => e.carteira).filter((v): v is string => !!v))].sort(),
    [employees]
  );
  const sindicatos = useMemo(
    () => [...new Set(employees.map((e) => e.sindicato).filter((v): v is string => !!v))].sort(),
    [employees]
  );

  const filtered = employees.filter(
    (e) =>
      (lotacaoFilter === ALL || e.base === lotacaoFilter) &&
      (carteiraFilter === ALL || e.carteira === carteiraFilter) &&
      (sindicatoFilter === ALL || e.sindicato === sindicatoFilter)
  );

  const totals = filtered.reduce(
    (acc, e) => ({
      salary: acc.salary + (e.salary ?? 0),
      valorAdicional: acc.valorAdicional + e.valorAdicional,
      salarioTotal: acc.salarioTotal + (e.salarioTotal ?? 0),
      vale: acc.vale + e.vale,
      planoSaude: acc.planoSaude + (e.planoSaude ?? 0),
      planoOdontologico: acc.planoOdontologico + (e.planoOdontologico ?? 0),
      seguroVida: acc.seguroVida + (e.seguroVida ?? 0),
      encargos: acc.encargos + e.encargos,
      custoTotal: acc.custoTotal + e.custoTotal,
    }),
    { salary: 0, valorAdicional: 0, salarioTotal: 0, vale: 0, planoSaude: 0, planoOdontologico: 0, seguroVida: 0, encargos: 0, custoTotal: 0 }
  );

  function openEmployee(emp: SalaryEmployeeRow) {
    if (!canManage) return;
    setSelected(emp);
    setSalary(emp.salary?.toString() ?? "");
    setAdicionalPercentual(emp.adicionalPercentual?.toString() ?? "");
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
          adicionalPercentual: adicionalPercentual === "" ? null : Number(adicionalPercentual),
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
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Detalhamento por Colaborador</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Todo componente do custo, linha a linha: salário-base, adicional, vale (diária × dias úteis) e encargos.{" "}
                {canManage ? "Clique numa linha para editar." : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={lotacaoFilter} onValueChange={setLotacaoFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Lotação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as lotações</SelectItem>
                  {lotacoes.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={carteiraFilter} onValueChange={setCarteiraFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Carteira" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas as carteiras</SelectItem>
                  {carteiras.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sindicatoFilter} onValueChange={setSindicatoFilter}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Sindicato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os sindicatos</SelectItem>
                  {sindicatos.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="min-w-[1600px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Nome</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Carteira</TableHead>
                    <TableHead>Lotação</TableHead>
                    <TableHead>Sindicato</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Salário Base</TableHead>
                    <TableHead className="text-right">Adicional %</TableHead>
                    <TableHead className="text-right">Valor Adicional</TableHead>
                    <TableHead className="text-right bg-emerald-50/60 dark:bg-emerald-950/20">Salário Total</TableHead>
                    <TableHead className="text-right">Diária/dia</TableHead>
                    <TableHead className="text-right">Dias Úteis</TableHead>
                    <TableHead className="text-right bg-amber-50/60 dark:bg-amber-950/20">Vale Alimentação</TableHead>
                    <TableHead className="text-right">Plano Saúde</TableHead>
                    <TableHead className="text-right">Plano Odonto</TableHead>
                    <TableHead className="text-right">Seguro Vida</TableHead>
                    <TableHead className="text-right bg-sky-50/60 dark:bg-sky-950/20">Encargos Total</TableHead>
                    <TableHead className="text-right bg-muted font-semibold">Custo Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((emp) => (
                    <TableRow
                      key={emp.id}
                      onClick={() => openEmployee(emp)}
                      className={canManage ? "cursor-pointer hover:bg-muted/50" : undefined}
                    >
                      <TableCell className="font-medium sticky left-0 bg-background">{emp.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{emp.funcao}</TableCell>
                      <TableCell className="whitespace-nowrap">{emp.carteira ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{emp.base ?? "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {emp.sindicato ?? <span className="text-muted-foreground italic">sem sindicato</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={emp.situacao === "ATIVO" ? "default" : "secondary"} className="text-xs">
                          {emp.situacao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {emp.salary != null ? fmt(emp.salary) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {emp.adicionalPercentual != null ? `${emp.adicionalPercentual}%` : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {emp.valorAdicional > 0 ? fmt(emp.valorAdicional) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium bg-emerald-50/40 dark:bg-emerald-950/10">
                        {emp.salarioTotal != null ? fmt(emp.salarioTotal) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt2(emp.diariaRate)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{emp.diasUteis}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-mono text-sm bg-amber-50/40 dark:bg-amber-950/10",
                          emp.valeStatus === "missing" && "bg-red-100 dark:bg-red-950/40"
                        )}
                        title={
                          emp.valeStatus === "missing"
                            ? "Nenhuma diária configurada pro sindicato deste colaborador (nem valor padrão) — vale saindo R$ 0,00"
                            : emp.valeStatus === "default"
                              ? "Usando a diária padrão do projeto (sem valor específico pro sindicato deste colaborador)"
                              : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-1 justify-end">
                          {emp.valeStatus === "missing" && <AlertTriangle className="h-3 w-3 text-red-600" />}
                          {fmt(emp.vale)}
                          {emp.valeStatus === "default" && <span className="text-[10px] text-muted-foreground">(padrão)</span>}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {emp.planoSaude != null ? fmt(emp.planoSaude) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {emp.planoOdontologico != null ? fmt(emp.planoOdontologico) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {emp.seguroVida != null ? fmt(emp.seguroVida) : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-medium bg-sky-50/40 dark:bg-sky-950/10">
                        {fmt(emp.encargos)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold bg-muted">{fmt(emp.custoTotal)}</TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={18} className="text-center text-muted-foreground py-8">
                        Nenhum colaborador encontrado com esses filtros
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                {filtered.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-muted/70 font-semibold">
                      <TableCell className="sticky left-0 bg-muted/70" colSpan={6}>
                        Total ({filtered.length} colaborador{filtered.length !== 1 ? "es" : ""})
                      </TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.salary)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right font-mono">{fmt(totals.valorAdicional)}</TableCell>
                      <TableCell className="text-right font-mono bg-emerald-100/60 dark:bg-emerald-950/30">{fmt(totals.salarioTotal)}</TableCell>
                      <TableCell />
                      <TableCell />
                      <TableCell className="text-right font-mono bg-amber-100/60 dark:bg-amber-950/30">{fmt(totals.vale)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.planoSaude)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.planoOdontologico)}</TableCell>
                      <TableCell className="text-right font-mono">{fmt(totals.seguroVida)}</TableCell>
                      <TableCell className="text-right font-mono bg-sky-100/60 dark:bg-sky-950/30">{fmt(totals.encargos)}</TableCell>
                      <TableCell className="text-right font-mono bg-muted">{fmt(totals.custoTotal)}</TableCell>
                    </TableRow>
                  </tfoot>
                )}
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Salário</label>
                <Input type="number" step="0.01" min="0" value={salary} onChange={(e) => setSalary(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Adicional (%)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={adicionalPercentual}
                  onChange={(e) => setAdicionalPercentual(e.target.value)}
                  placeholder="ex: 30"
                />
                <p className="text-[10px] text-muted-foreground">Insalubridade/periculosidade — % sobre o salário</p>
              </div>
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
            {selected && (
              <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/40">
                <p className="font-medium text-muted-foreground mb-1">Composição atual do custo total carregado (antes de salvar)</p>
                <div className="flex justify-between"><span>Salário + adicional</span><span className="font-mono">{fmt(selected.salarioTotal ?? 0)}</span></div>
                <div className="flex justify-between"><span>Vale ({selected.sindicato ?? "sem sindicato"} × {selected.diasUteis}d)</span><span className="font-mono">{fmt(selected.vale)}</span></div>
                <div className="flex justify-between"><span>Encargos (planos)</span><span className="font-mono">{fmt(selected.encargos)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span className="font-mono">{fmt(selected.custoTotal)}</span></div>
              </div>
            )}
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
