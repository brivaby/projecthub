import ProjectDiscovery from "@/components/project-discovery";
export const metadata = { title: "Browse projects" };
export default function Trending({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <ProjectDiscovery searchParams={searchParams} />;
}
