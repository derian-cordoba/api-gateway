const sections = [
  ["proxy", "Upstream"],
  ["validation", "Request validation"],
  ["webhook", "Webhook verification"],
  ["authentication", "Authentication"],
  ["rateLimit", "Rate limiting"],
  ["circuitBreaker", "Circuit breaker"],
  ["retry", "Retries"],
  ["cache", "Response cache"],
  ["ipFilter", "IP filtering"],
  ["headers", "Header transforms"],
  ["cors", "CORS"],
] as const;

export function EditorNavigation({ enabledSections }: { enabledSections: Set<string> }) {
  return (
    <aside className="editor-nav">
      <p>Configuration</p>
      {sections.map(([id, label]) => (
        <a href={`#${id}`} className={enabledSections.has(id) ? "enabled" : ""} key={id}>
          <span />
          {label}
        </a>
      ))}
    </aside>
  );
}
