import type { Metadata } from "next";
import "./globals.css";
import { Header, Footer } from "@/components/shell";
export const metadata: Metadata = {
  title: {
    default: "Vic Academy ProjectHub — Student ideas, shared possibilities",
    template: "%s · Vic Academy ProjectHub",
  },
  description:
    "Discover inspiring Vic Academy student projects, share what you are building, and find your next collaborator.",
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
