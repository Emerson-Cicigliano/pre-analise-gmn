export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="7" fill="none" stroke="var(--accent)" strokeWidth="1.5" opacity=".5" />
      <path d="M14 7.5c-2.6 0-4.5 1.9-4.5 4.4 0 3.3 4.5 8.1 4.5 8.1s4.5-4.8 4.5-8.1c0-2.5-1.9-4.4-4.5-4.4z" fill="var(--ink)" />
      <circle cx="14" cy="11.9" r="1.6" fill="var(--accent)" />
    </svg>
  );
}
