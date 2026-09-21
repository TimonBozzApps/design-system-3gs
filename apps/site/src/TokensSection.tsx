export interface TokensSectionProps {
  theme: "dark" | "light";
}

/** Filled in by the tokens-docs task: palette, gel gradients, radii, shadows, type. */
export function TokensSection({ theme }: TokensSectionProps) {
  return (
    <section className="demo" id="tokens">
      <div className="demo__text">
        <h2>Tokens</h2>
        <p>Design tokens ({theme}) — coming up.</p>
      </div>
    </section>
  );
}
