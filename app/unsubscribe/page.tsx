export const dynamic = 'force-dynamic';

type UnsubscribePageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function UnsubscribePage(props: UnsubscribePageProps) {
  const searchParams = await props.searchParams;
  const token = typeof searchParams?.token === 'string' ? searchParams.token : '';
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-3xl font-black tracking-tight">Manage content notifications</h1>
      <p className="mt-4 text-sm text-neutral-600">
        To stop content notification emails, confirm below. This page does not reveal whether a link or recipient is valid.
      </p>
      <form className="mt-8" action="/api/subscriptions/unsubscribe" method="post">
        <input type="hidden" name="token" value={token} />
        <button className="rounded-full bg-neutral-950 px-6 py-3 text-sm font-bold text-white" type="submit">
          Stop content notifications
        </button>
      </form>
    </main>
  );
}
