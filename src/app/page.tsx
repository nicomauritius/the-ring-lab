import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <h1 className="font-serif text-[clamp(3.25rem,13vw,9rem)] font-normal leading-none tracking-[-0.035em] text-balance">
        Hello world<span className="text-clay">.</span>
      </h1>
      <div>
        <Link href="/design" className="inline-block rounded-full bg-ink px-6 py-3 text-paper hover:opacity-90">
          Design your ring
        </Link>
      </div>
    </main>
  );
}
