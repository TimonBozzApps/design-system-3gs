export interface PreviewSectionProps {
  theme: "dark" | "light";
  dir: "ltr" | "rtl";
}

/** Placeholder — replaced by the "3GS-ify a website" feature. */
export function PreviewSection({ theme }: PreviewSectionProps) {
  return (
    <section className="demo" id="try-it">
      <div className="demo__text">
        <h2>Try it on your site</h2>
        <p>Coming up ({theme}).</p>
      </div>
    </section>
  );
}
