import Home, { generateMetadata } from "../page";

export { generateMetadata };
export const dynamic = "force-dynamic";

export default async function T1Page(props: { searchParams: Promise<{ v?: string; q?: string }> }) {
  return (
    <div className="ui-clone-skin ui-clone-skin-t1">
      <Home {...props} />
    </div>
  );
}
