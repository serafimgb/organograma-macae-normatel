"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle, XCircle, Loader2 } from "lucide-react";

interface ImportResult {
  created: number;
  updated: number;
  errors: string[];
}

export function SalaryImportForm({ projectCode }: { projectCode: string }) {
  const router = useRouter();
  const [matchBy, setMatchBy] = useState<"CHAPA" | "FUNCAO">("CHAPA");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setStatus("loading");
    const form = new FormData();
    form.append("file", file);
    form.append("matchBy", matchBy);

    try {
      const res = await fetch(`/projects/${projectCode}/salarios/import`, { method: "POST", body: form });
      const data: ImportResult = await res.json();
      if (!res.ok) throw new Error((data as unknown as { errors?: string[] }).errors?.[0] ?? "Erro desconhecido");
      setResult(data);
      setStatus("success");
      router.refresh();
    } catch (err) {
      setResult({ created: 0, updated: 0, errors: [(err as Error).message] });
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Importar Salários em Lote</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Casar colaboradores por</label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={matchBy === "CHAPA" ? "default" : "outline"} onClick={() => setMatchBy("CHAPA")}>
                CHAPA
              </Button>
              <Button type="button" size="sm" variant={matchBy === "FUNCAO" ? "default" : "outline"} onClick={() => setMatchBy("FUNCAO")}>
                Função
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo .xlsx</label>
            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 text-center transition hover:border-primary/50"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-6 w-6 text-muted-foreground mb-2" />
              {file ? (
                <span className="text-sm font-medium">{file.name}</span>
              ) : (
                <span className="text-sm text-muted-foreground">Clique para selecionar ou arraste aqui</span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <Button type="submit" disabled={!file || status === "loading"} className="w-full">
            {status === "loading" ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Importar</>
            )}
          </Button>

          {status === "success" && result && (
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/20 p-4 text-sm space-y-1">
              <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle className="h-4 w-4" /> Importação concluída
              </div>
              <div>{result.updated} colaborador(es) atualizado(s)</div>
              {result.errors.length > 0 && (
                <div className="text-amber-600">
                  {result.errors.length} linha(s) com erro:
                  <ul className="mt-1 list-disc list-inside">
                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}

          {status === "error" && result && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-4 text-sm">
              <div className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
                <XCircle className="h-4 w-4" /> Falha na importação
              </div>
              <p>{result.errors[0]}</p>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
