import Home, { generateMetadata } from "../page";

export { generateMetadata };
export const dynamic = "force-dynamic";

export default async function T2Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return (
    <div className="ui-clone-skin ui-clone-skin-t2">
      <Home {...props} />
    </div>
  );
}
