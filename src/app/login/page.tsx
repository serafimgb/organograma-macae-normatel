import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const callbackUrl = searchParams.callbackUrl ?? "/projects";

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f4f7f4" }}>
      {/* Painel esquerdo — brand */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12"
        style={{ background: "linear-gradient(145deg, #2d7a2d 0%, #1a4f1a 100%)" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-branco.png"
          alt="Normatel Engenharia"
          className="object-contain mb-10 w-80"
        />
        <p className="text-white/80 text-lg font-light text-center max-w-xs leading-relaxed">
          Gestão de projetos, organogramas e efetivo em um único lugar.
        </p>
        <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-xs">
          {[
            { label: "Projetos", value: "4" },
            { label: "Colaboradores", value: "1.9K+" },
            { label: "Carteiras", value: "11" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-white text-2xl font-bold">{stat.value}</div>
              <div className="text-white/60 text-xs mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Painel direito — login */}
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        {/* Logo mobile */}
        <div className="lg:hidden mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horizontal.png"
            alt="Normatel Engenharia"
            className="object-contain w-52"
          />
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">Bem-vindo</h1>
          <p className="text-slate-500 text-sm mb-8">
            Acesse com sua conta Microsoft corporativa
          </p>

          {searchParams.error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
              Erro ao autenticar. Tente novamente.
            </div>
          )}

          <form
            action={async () => {
              "use server";
              await signIn("microsoft-entra-id", { redirectTo: callbackUrl });
            }}
          >
            <Button
              type="submit"
              size="lg"
              className="w-full h-12 text-sm font-semibold shadow-sm"
              style={{ backgroundColor: "#2d7a2d" }}
            >
              <svg className="mr-2.5 h-4 w-4 shrink-0" viewBox="0 0 21 21" fill="none">
                <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
              </svg>
              Entrar com Microsoft
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Normatel Engenharia · Acesso restrito a colaboradores
          </p>
        </div>
      </div>
    </div>
  );
}
