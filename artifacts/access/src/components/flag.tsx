// Renders an SVG country flag derived from a flag emoji (e.g. "🇸🇦" → Saudi
// flag) using the flag-icons library. This avoids the OS/browser emoji
// fallback (e.g. Windows + Chrome showing "SA"/"GB"/"FR" letters) and renders
// consistently across Windows, macOS, Linux, Chrome and Edge.
//
// The flag emoji stays the source of truth in the database; we just convert it
// to an ISO 3166-1 alpha-2 code at render time (two regional-indicator symbols
// map back to the two country letters).
function emojiToCountryCode(emoji: string): string | null {
  const codePoints = Array.from(emoji).map((c) => c.codePointAt(0) ?? 0);
  const letters = codePoints
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)
    .map((cp) => String.fromCharCode(cp - 0x1f1e6 + 65));
  return letters.length === 2 ? letters.join("").toLowerCase() : null;
}

export function Flag({
  emoji,
  className,
  title,
  square,
}: {
  emoji: string;
  className?: string;
  title?: string;
  // When true, render the 1:1 square flag variant (flag-icons `fis`), which is
  // what a circular flag container needs so the flag fills the circle instead
  // of being letter-boxed.
  square?: boolean;
}) {
  const code = emojiToCountryCode(emoji);

  // Non-flag / unknown emoji: render it as-is rather than nothing.
  if (!code) {
    return <span className={className}>{emoji}</span>;
  }

  return (
    <span
      className={`fi ${square ? "fis " : ""}fi-${code} rounded-[2px] align-middle ${className ?? ""}`}
      role="img"
      aria-label={title ?? code}
      title={title}
    />
  );
}
