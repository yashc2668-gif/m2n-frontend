import { Card } from '@/components/ui/card';

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="overflow-hidden p-8 text-center">
      <div className="relative mx-auto max-w-md">
        <div
          aria-hidden="true"
          className="absolute inset-x-10 top-6 h-24 rounded-full bg-[radial-gradient(circle,_rgba(245,158,11,0.18),_transparent_70%)] blur-2xl"
        />
        <div className="relative space-y-4">
          <div className="mx-auto flex size-32 items-center justify-center">
            <svg
              viewBox="0 0 180 140"
              className="h-full w-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="26" y="34" width="128" height="82" rx="24" fill="#FFF9ED" stroke="#F2D49A" strokeWidth="2" />
              <rect x="42" y="50" width="96" height="12" rx="6" fill="#F6E1B7" />
              <rect x="42" y="72" width="68" height="10" rx="5" fill="#F9ECD0" />
              <rect x="42" y="90" width="82" height="10" rx="5" fill="#F9ECD0" />
              <path d="M128 34C128 20.75 117.25 10 104 10H76C62.75 10 52 20.75 52 34" stroke="#C98913" strokeWidth="8" strokeLinecap="round" />
              <circle cx="140" cy="42" r="16" fill="#FFF4D6" stroke="#E1B562" strokeWidth="2" />
              <path d="M136 42.5L139.5 46L145.5 38.5" stroke="#C98913" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="space-y-2">
            <h3 className="text-xl text-[var(--surface-ink)]">{title}</h3>
            <p className="text-sm leading-6 text-[var(--surface-muted)]">{description}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
