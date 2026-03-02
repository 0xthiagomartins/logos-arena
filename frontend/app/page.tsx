import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
      <div className="rounded-2xl border border-matrix-dim/50 bg-matrix-dark/70 p-8 md:p-12">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-matrix-dim">debate engine</p>
        <h1 className="mb-4 text-4xl font-bold text-matrix-green md:text-6xl">LogosArena</h1>
        <p className="max-w-2xl text-base leading-relaxed text-matrix-dim md:text-lg">
          Debates estruturados com IA, rounds rastreáveis e mediação explicável em um fluxo claro:
          criar, acompanhar, concluir.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/debates/new"
            className="rounded-lg border border-matrix-green bg-matrix-green/10 px-5 py-3 text-center text-sm font-bold text-matrix-green transition hover:bg-matrix-green/20"
          >
            Novo debate
          </Link>
          <Link
            href="/debates"
            className="rounded-lg border border-matrix-dim/70 bg-matrix-muted/20 px-5 py-3 text-center text-sm font-bold text-matrix-dim transition hover:bg-matrix-muted/35"
          >
            Meus debates
          </Link>
        </div>
      </div>
    </main>
  );
}
