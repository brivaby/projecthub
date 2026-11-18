import Explore from "../explore/page";
export const metadata = { title: "Trending projects" };
export default function Trending() {
  return <Explore searchParams={Promise.resolve({ sort: "relevance" })} />;
}
