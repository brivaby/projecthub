import Link from "next/link";
import { NavigationLink } from "./navigation-link";
import { ThemeToggle } from "./theme-toggle";
import { Layers, Search, Plus, ArrowUpRight, Bell, Menu } from "lucide-react";
import { auth, signOut } from "@/auth";
import { db } from "@/lib/db";
export async function Header() {
  const s = await auth();
  const user = s?.user?.id
    ? await db.user.findUnique({
        where: { id: s.user.id },
        select: { role: true, suspended: true, deletedAt: true },
      })
    : null;
  const logged = !!user && !user.suspended && !user.deletedAt;
  const primary = [
    { href: "/trending", label: "Browse projects" },
    { href: "/categories", label: "Categories" },
    { href: "/trending", label: "Trending" },
    ...(logged ? [{ href: "/courses", label: "My courses" }] : []),
  ];
  const account = logged ? [
    { href: "/dashboard", label: "My workspace" },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: "Admin" }] : []),
  ] : [{ href: "/login", label: "Log in" }];
  const links = (items: typeof primary, className?: string) => items.map(({ href, label }) => (
    <NavigationLink key={href} href={href} className={className}>
      {label}
    </NavigationLink>
  ));
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link href="/" className="brand">
          <span>
            <Layers size={22} />
          </span>
          <span className="brand-words">
            <small>VIC ACADEMY</small>ProjectHub
            <span className="brand-dot">.</span>
          </span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          {links(primary)}
        </nav>
        <div className="nav-actions">
          <Link
            href="/trending"
            className="icon-button"
            aria-label="Search projects"
          >
            <Search size={19} />
          </Link>
          {logged && (
            <Link href="/notifications" className="icon-button" aria-label="Notifications">
              <Bell size={19} />
            </Link>
          )}
          {links(account, "nav-login")}
          <Link href="/upload" className="button small">
            <Plus size={16} />
            Share a project
          </Link>
          <details className="mobile-nav">
            <summary aria-label="Open navigation">
              <Menu />
            </summary>
            <nav aria-label="Mobile navigation">
              {links([...primary, ...account])}
              {logged && links([
                { href: "/requests", label: "Requests" },
                { href: "/settings", label: "Settings" },
              ])}
              {logged && (
                <form
                  action={async () => {
                    "use server";
                    await signOut();
                  }}
                >
                  <button>Sign out</button>
                </form>
              )}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <div>
          <Link href="/" className="brand">
            <Layers size={22} />
            Vic Academy ProjectHub.
          </Link>
          <p>Good ideas deserve to go beyond the classroom.</p>
        </div>
        <div>
          <Link href="/trending">Browse projects</Link>
          <Link href="/about">About Vic Academy</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/guidelines">Guidelines</Link>
          <Link href="/copyright">Copyright</Link>
          <Link href="/cookies">Cookies</Link>
          <Link href="/upload">
            Share your work <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} Vic Academy ProjectHub. Built for curious
          minds.
        </span>
        <ThemeToggle/><span>Made for learning. Open to possibility.</span>
      </div>
    </footer>
  );
}
