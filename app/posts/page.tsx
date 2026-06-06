import Link from "next/link";

const PER_PAGE = 10;
const TOTAL = 100;
const TOTAL_PAGES = TOTAL / PER_PAGE;

type Post = { id: number; title: string; body: string; userId: number };

async function getPosts(page: number): Promise<Post[]> {
  const res = await fetch(
    `https://jsonplaceholder.typicode.com/posts?_page=${page}&_limit=${PER_PAGE}`
  );
  return res.json();
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.min(Math.max(Number(pageParam) || 1, 1), TOTAL_PAGES);
  const posts = await getPosts(page);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold mb-1">Posts</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Página {page} de {TOTAL_PAGES} — cada troca de página dispara um fetch SSR
      </p>

      <ul className="flex flex-col gap-3 max-w-2xl mb-8">
        {posts.map((post) => (
          <li key={post.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <span className="text-xs text-zinc-600 font-mono">#{post.id}</span>
            <p className="text-sm font-medium text-zinc-100 capitalize mt-1">{post.title}</p>
            <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{post.body}</p>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2 max-w-2xl">
        {page > 1 ? (
          <Link
            href={`/posts?page=${page - 1}`}
            className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="px-4 py-2 rounded bg-zinc-900 text-zinc-600 text-sm cursor-not-allowed">
            ← Anterior
          </span>
        )}

        <div className="flex gap-1 flex-wrap">
          {Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/posts?page=${p}`}
              className={`w-8 h-8 flex items-center justify-center rounded text-xs transition-colors ${
                p === page
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
              }`}
            >
              {p}
            </Link>
          ))}
        </div>

        {page < TOTAL_PAGES ? (
          <Link
            href={`/posts?page=${page + 1}`}
            className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-sm transition-colors"
          >
            Próxima →
          </Link>
        ) : (
          <span className="px-4 py-2 rounded bg-zinc-900 text-zinc-600 text-sm cursor-not-allowed">
            Próxima →
          </span>
        )}
      </div>
    </div>
  );
}
