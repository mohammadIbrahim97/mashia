import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-6">
      <div className="text-center max-w-md">
        <div className="font-mono text-[11px] tracking-mono-wide uppercase text-muted">
          404 · NOT FOUND
        </div>
        <h1 className="font-display text-5xl font-light tracking-tight text-ink mt-2">
          That page doesn&apos;t exist.
        </h1>
        <p className="text-[15px] text-muted mt-4">
          Either the link is wrong, or whatever was here moved on.
        </p>
        <Link
          href="/dashboard"
          className="inline-block mt-6 font-body font-semibold text-mashia-700 hover:underline"
        >
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}
