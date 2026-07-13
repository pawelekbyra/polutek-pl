export default function GlassLoading() {
  return (
    <div className="glass-page" aria-busy="true" aria-label="Ładowanie strony">
      <div className="glass-loading-nav">
        <span className="glass-loading-pill glass-loading-logo" />
        <span className="glass-loading-pill glass-loading-search" />
        <span className="glass-loading-pill glass-loading-actions" />
      </div>
      <main className="glass-loading-shell">
        <section className="glass-loading-main">
          <div className="glass-loading-media" />
          <div className="glass-loading-line glass-loading-title" />
          <div className="glass-loading-line glass-loading-subtitle" />
          <div className="glass-loading-controls">
            <span className="glass-loading-pill" />
            <span className="glass-loading-pill" />
            <span className="glass-loading-pill" />
          </div>
          <div className="glass-loading-description" />
        </section>
        <aside className="glass-loading-sidebar">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="glass-loading-video" key={index}>
              <span />
              <div>
                <i />
                <i />
              </div>
            </div>
          ))}
        </aside>
      </main>
    </div>
  );
}
