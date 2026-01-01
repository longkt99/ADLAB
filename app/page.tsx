import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-2xl px-8 py-12 bg-card rounded-lg shadow-xl text-center border border-border">
        <h1 className="text-5xl font-bold text-foreground mb-4">
          Content Machine
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Multi-Platform Content Engine
        </p>
        <p className="text-foreground/80 mb-8">
          Create once, publish everywhere. Generate platform-specific variants
          with AI-powered optimization for 13+ social platforms.
        </p>
        <Link
          href="/posts"
          className="inline-block px-8 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-all"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
