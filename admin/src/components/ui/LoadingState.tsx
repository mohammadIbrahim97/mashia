type Props = {
  label?: string;
};

export function LoadingState({ label = 'Loading…' }: Props) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted animate-pulse">
      <span className="h-2 w-2 rounded-full bg-muted" />
      <span>{label}</span>
    </div>
  );
}
