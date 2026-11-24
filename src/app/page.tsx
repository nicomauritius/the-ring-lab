import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col border-b border-line">
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-8 sm:py-28">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted sm:text-sm">
          Zero pressure. Zero risk. Total confidence.
        </p>
        <h1 className="mt-10 font-serif font-normal leading-[1.05] tracking-tight text-balance">
          <span className="block text-[clamp(3rem,10vw,6.5rem)]">Get Informed.</span>
          <span className="mt-2 block text-[clamp(3rem,10vw,6.5rem)] italic text-clay">Create what&apos;s yours.</span>
        </h1>
        <p className="mt-10 max-w-3xl text-lg leading-relaxed text-muted sm:text-2xl sm:leading-relaxed">
          A ring this important has a steep learning curve, explore every option at your own pace until you know what
          you want.
        </p>
        <Link
          href="/design"
          className="mt-14 inline-flex items-center gap-3 rounded-full bg-clay px-10 py-4 text-lg font-medium text-clay-ink shadow-sm hover:opacity-90"
        >
          Start designing
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
            <path d="M4 10h12M11 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>
    </main>
  );
}
