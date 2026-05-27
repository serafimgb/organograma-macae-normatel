"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDate } from "@/lib/utils";
import { Search } from "lucide-react";

type Situacao = "ATIVO" | "DESLIGADO" | "AFASTADO" | "FERIAS" | "LICENCA";

interface Employee {
  id: string;
  chapa: string;
  nome: string;
  funcao: string;
  carteira: string;
  base: string;
  situacao: Situacao;
  admissao: string;
  demissao: string | null;
  salary: number | null;
}

interface EfetivoTableProps {
  employees: Employee[];
  carteiras: { id: string; name: string }[];
  bases: { id: string; name: string }[];
  showSalary: boolean;
}

const situacaoBadge: Record<Situacao, { label: string; variant: "success" | "destructive" | "warning" | "secondary" }> = {
  ATIVO: { label: "Ativo", variant: "success" },
  DESLIGADO: { label: "Desligado", variant: "destructive" },
  AFASTADO: { label: "Afastado", variant: "warning" },
  FERIAS: { label: "Férias", variant: "secondary" },
  LICENCA: { label: "Licença", variant: "secondary" },
};

export function EfetivoTable({ employees, carteiras, bases, showSalary }: EfetivoTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "TODOS" && value !== "_all_") params.set(key, value);
    else params.delete(key);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", search);
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou chapa…"
            className="pl-9 w-64"
          />
        </form>

        <Select
          defaultValue={searchParams.get("situacao") ?? "TODOS"}
          onValueChange={(v) => updateParam("situacao", v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Situação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas</SelectItem>
            <SelectItem value="ATIVO">Ativo</SelectItem>
            <SelectItem value="DESLIGADO">Desligado</SelectItem>
            <SelectItem value="AFASTADO">Afastado</SelectItem>
            <SelectItem value="FERIAS">Férias</SelectItem>
            <SelectItem value="LICENCA">Licença</SelectItem>
          </SelectContent>
        </Select>

        <Select
          defaultValue={searchParams.get("carteira") ?? "_all_"}
          onValueChange={(v) => updateParam("carteira", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Carteira" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Todas</SelectItem>
            {carteiras.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          defaultValue={searchParams.get("base") ?? "_all_"}
          onValueChange={(v) => updateParam("base", v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Base" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all_">Todas</SelectItem>
            {bases.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chapa</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Carteira</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Admissão</TableHead>
              <TableHead>Demissão</TableHead>
              {showSalary && <TableHead className="text-right">Salário</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showSalary ? 9 : 8} className="text-center text-muted-foreground py-8">
                  Nenhum colaborador encontrado
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => {
                const sit = situacaoBadge[emp.situacao];
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-xs">{emp.chapa}</TableCell>
                    <TableCell className="font-medium">{emp.nome}</TableCell>
                    <TableCell className="text-sm">{emp.funcao}</TableCell>
                    <TableCell className="text-sm">{emp.carteira}</TableCell>
                    <TableCell className="text-sm">{emp.base}</TableCell>
                    <TableCell>
                      <Badge variant={sit.variant}>{sit.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(emp.admissao)}</TableCell>
                    <TableCell className="text-sm">{formatDate(emp.demissao)}</TableCell>
                    {showSalary && (
                      <TableCell className="text-right font-mono text-sm">
                        {formatBRL(emp.salary)}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
