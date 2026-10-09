import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const links = [
    { href: "/", label: "განრიგი" },
    me.can("events.create") && { href: "/events/new", label: "+ ახალი გადაღება" },
    me.can("users.manage") && { href: "/admin/users", label: "მომხმარებლები" },
    me.can("roles.manage") && { href: "/admin/roles", label: "როლები" },
    { href: "/profile", label: "პროფილი" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">🎥 პრეს ცენტრი</Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-2 py-1 text-gray-700 hover:bg-gray-100">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {me.profile.full_name}
              {me.role && <span className="text-gray-400"> · {me.role.name}</span>}
            </span>
            <form action={signOut}>
              <button className="text-gray-500 hover:text-gray-900">გასვლა</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
