import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans flex flex-col items-start">
      <h1 className="text-2xl font-bold mb-1">SSR Network Panel — Demo</h1>
      <p className="text-zinc-400 text-sm mb-8">
        Navegue para uma página e abra o painel (canto inferior direito) para ver as requests SSR.
      </p>
      <nav className="flex flex-col gap-3">
        <Link
          href="/posts"
          className="rounded-lg bg-zinc-900 border border-zinc-800 px-5 py-4 hover:border-zinc-600 transition-colors w-64"
        >
          <p className="font-semibold text-zinc-100">Posts</p>
          <p className="text-xs text-zinc-500 mt-1">GET /posts — 100 items</p>
        </Link>
        <Link
          href="/users"
          className="rounded-lg bg-zinc-900 border border-zinc-800 px-5 py-4 hover:border-zinc-600 transition-colors w-64"
        >
          <p className="font-semibold text-zinc-100">Users</p>
          <p className="text-xs text-zinc-500 mt-1">GET /users — 10 items</p>
        </Link>
      </nav>
    </div>
  );
}
