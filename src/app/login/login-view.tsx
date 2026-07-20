"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

const stats = [
  { label: "Projetos", value: "4" },
  { label: "Colaboradores", value: "1.9K+" },
  { label: "Carteiras", value: "11" },
];

export function LoginView({
  error,
  onSignIn,
}: {
  error?: string;
  onSignIn: () => Promise<void>;
}) {
  return (
    <div className="min-h-screen flex bg-[#f4f7f4]">
      {/* Painel esquerdo */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col items-center justify-center p-12 overflow-hidden bg-[#173617]">
        <motion.div
          className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full bg-[#4caf50]/30 blur-[100px]"
          animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="pointer-events-none absolute -bottom-40 -right-16 h-[28rem] w-[28rem] rounded-full bg-[#1a4f1a]/60 blur-[120px]"
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        <motion.div
          className="relative z-10 flex flex-col items-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-branco.png"
            alt="Normatel Engenharia"
            className="object-contain mb-10 w-72"
          />
          <p className="text-white/70 text-base font-light text-center max-w-xs leading-relaxed">
            Gestão de projetos, organogramas e efetivo em um único lugar.
          </p>

          <div className="mt-14 grid grid-cols-3 gap-8 w-full max-w-xs">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                className="text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1, ease: "easeOut" }}
              >
                <div className="text-white text-2xl font-semibold tabular-nums">
                  {stat.value}
                </div>
                <div className="text-white/50 text-[11px] mt-1 tracking-wide uppercase">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Painel direito */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="lg:hidden mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horizontal.png"
            alt="Normatel Engenharia"
            className="object-contain w-52"
          />
        </div>

        <motion.div
          className="w-full max-w-sm"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <span className="text-[11px] font-semibold tracking-[0.15em] text-[#2d7a2d] uppercase">
            Acesso corporativo
          </span>
          <h1 className="text-3xl font-bold text-slate-900 mt-2 mb-1">
            Bem-vindo de volta
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            Entre com sua conta Microsoft para continuar.
          </p>

          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25 }}
              className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6 overflow-hidden"
            >
              Não foi possível autenticar. Tente novamente.
            </motion.div>
          )}

          <form action={onSignIn}>
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button
                type="submit"
                size="lg"
                className="w-full h-12 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow bg-[#2d7a2d] hover:bg-[#256425]"
              >
                <svg className="mr-2.5 h-4 w-4 shrink-0" viewBox="0 0 21 21" fill="none">
                  <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                  <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                  <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                  <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                </svg>
                Entrar com Microsoft
              </Button>
            </motion.div>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Normatel Engenharia · Acesso restrito a colaboradores
          </p>
        </motion.div>
      </div>
    </div>
  );
}
