"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEntranceMotion } from "@/lib/motion";

interface CarteiraItem { name: string; total: number }
interface FuncaoItem { name: string; media: number }
interface CustoTotalItem { label: string; total: number }

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * O ResponsiveContainer do recharts mede o tamanho do pai via ResizeObserver assim que
 * monta. Dentro de um motion.div com opacity/transform animando na entrada, essa primeira
 * medição às vezes pega o container com tamanho 0 e o gráfico fica invisível até algum
 * evento (ex: hover) forçar um novo resize. Só montamos o gráfico depois do primeiro
 * paint, quando o layout já está estável — assim ele nasce visível, sem depender de hover.
 */
function ChartMount({ height, children }: { height: number; children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!ready) {
    return <div style={{ height }} className="animate-pulse rounded-md bg-muted/40" />;
  }
  return <>{children}</>;
}

export function SalarioCharts({
  carteiraData,
  funcaoData,
  custoTotalData,
}: {
  carteiraData?: CarteiraItem[];
  funcaoData?: FuncaoItem[];
  custoTotalData?: CustoTotalItem[];
}) {
  const { fadeInUp, hoverLift } = useEntranceMotion();
  const custoTotalHeight = Math.max(220, (custoTotalData?.length ?? 0) * 60);

  return (
    <motion.div {...fadeInUp()} className="grid gap-6 lg:grid-cols-2">
      {carteiraData && carteiraData.length > 0 && (
        <motion.div {...hoverLift}>
          <Card>
            <CardHeader>
              <CardTitle>Total da Folha por Carteira</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartMount height={260}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={carteiraData} margin={{ top: 4, right: 8, bottom: 40, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => fmt(value as number)} labelFormatter={(l) => `Carteira: ${l}`} />
                    <Bar dataKey="total" fill="#2d7a2d" name="Total" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartMount>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {funcaoData && funcaoData.length > 0 && (
        <motion.div {...fadeInUp(0.1)} {...hoverLift}>
          <Card>
            <CardHeader>
              <CardTitle>Média Salarial por Função (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartMount height={260}>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={funcaoData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => fmt(value as number)} labelFormatter={(l) => `Função: ${l}`} />
                    <Bar dataKey="media" fill="#4caf50" name="Média" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartMount>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {custoTotalData && custoTotalData.length > 0 && (
        <motion.div {...fadeInUp(0.2)} {...hoverLift} className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Custo Total Carregado do Projeto</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartMount height={custoTotalHeight}>
                <ResponsiveContainer width="100%" height={custoTotalHeight}>
                  <BarChart data={custoTotalData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="label" width={160} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => fmt(value as number)} labelFormatter={() => ""} />
                    <Bar dataKey="total" fill="#3b82f6" name="Total" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartMount>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {(!carteiraData || carteiraData.length === 0) && (!funcaoData || funcaoData.length === 0) && (
        <motion.div {...fadeInUp()} className="lg:col-span-2">
          <Card>
            <CardContent className="flex items-center justify-center h-[260px] text-slate-500">
              Nenhum dado disponível para exibição
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}
