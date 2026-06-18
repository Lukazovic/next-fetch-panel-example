import Link from "next/link";
import axios from "axios";

const SORT_OPTIONS = ["name", "email", "id"] as const;
type SortKey = (typeof SORT_OPTIONS)[number];

type User = {
  id: number;
  name: string;
  email: string;
  phone: string;
  website: string;
  company: { name: string; catchPhrase: string };
  address: { street: string; city: string };
};

// adapter: "fetch" routes axios through globalThis.fetch, which is patched by instrumentation.ts
const http = axios.create({ adapter: "fetch" });

async function getUsers(sort: SortKey): Promise<User[]> {
  const { data } = await http.get<User[]>(
    `https://jsonplaceholder.typicode.com/users?_sort=${sort}`
  );
  return data;
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort: sortParam } = await searchParams;
  const sort: SortKey = SORT_OPTIONS.includes(sortParam as SortKey)
    ? (sortParam as SortKey)
    : "id";

  const users = await getUsers(sort);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 font-sans">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300 mb-6 inline-block">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold mb-1">Users</h1>
      <p className="text-zinc-500 text-sm mb-6">
        Each sort change triggers an SSR fetch — see it in the panel
      </p>

      <div className="flex gap-2 mb-6">
        <span className="text-xs text-zinc-500 self-center mr-1">Sort by:</span>
        {SORT_OPTIONS.map((opt) => (
          <Link
            key={opt}
            href={`/users?sort=${opt}`}
            className={`px-3 py-1.5 rounded text-xs transition-colors ${
              sort === opt
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
            }`}
          >
            {opt}
          </Link>
        ))}
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 w-full">
        {users.map((user) => (
          <li key={user.id} className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <p className="text-sm font-semibold text-zinc-100">{user.name}</p>
            <p className="text-xs text-zinc-400 mt-1">{user.email}</p>
            <p className="text-xs text-zinc-500">{user.phone}</p>
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-xs font-medium text-zinc-400">{user.company.name}</p>
              <p className="text-xs text-zinc-600 italic">{user.company.catchPhrase}</p>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              {user.address.street}, {user.address.city}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
