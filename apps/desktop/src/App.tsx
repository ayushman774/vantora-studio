import { useEffect, useState } from "react";
import { Activity, Clapperboard, Film, FolderOpen, LayoutDashboard, Settings2, Sparkles } from "lucide-react";
import { getBackendHealth, type HealthState } from "./api";
import Projects from "./ProjectLibrary";
import AssetLibrary from "./AssetLibrary";

const pages = [
  { name: "Overview", icon: LayoutDashboard },
  { name: "Projects", icon: FolderOpen },
  { name: "Production", icon: Clapperboard },
  { name: "Assets", icon: Film },
  { name: "Settings", icon: Settings2 },
] as const;
type Page = (typeof pages)[number]["name"];

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [health, setHealth] = useState<HealthState>({ status: "offline", detail: "Checking local backend…" });
  useEffect(() => {
    const controller = new AbortController();
    getBackendHealth(controller.signal).then(setHealth).catch(() => {});
    return () => controller.abort();
  }, []);
  async function refreshHealth() { setHealth(await getBackendHealth()); }
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><Sparkles size={22} /></div><div><strong>VANTORA</strong><span>STUDIO</span></div></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav aria-label="Primary navigation">{pages.map(({ name, icon: Icon }) => (
          <button key={name} type="button" className={page === name ? "nav-item selected" : "nav-item"} onClick={() => setPage(name)} aria-current={page === name ? "page" : undefined}><Icon size={18}/>{name}</button>
        ))}</nav>
        <div className="sidebar-bottom"><div className="version">PROJECT LIBRARY · 0.4.0</div><button type="button" className="health" onClick={refreshHealth} title="Recheck backend connection"><span className={health.status === "online" ? "dot online" : "dot"} /> <span>{health.detail}</span><Activity size={15}/></button></div>
      </aside>
      <main className="main"><header className="topbar"><span>Workspace / <strong>{page}</strong></span><span className="local-pill">LOCAL-FIRST STUDIO</span></header>
        <div className="content">{page === "Projects" ? <Projects /> : page === "Assets" ? <AssetLibrary /> : <><div className="eyebrow">YOUR CREATIVE COMMAND CENTER</div><h1>{page === "Overview" ? "Make worlds come alive." : page}</h1><p className="intro">{page === "Overview" ? "An intelligent production workspace for stories, characters, and cinematic shots. Built to keep your creative work in your hands." : "This workspace is reserved for the next production milestone. Navigation and the desktop foundation are ready."}</p>
          {page === "Overview" ? <div className="feature-grid"><section className="feature-card primary"><div className="card-icon"><Clapperboard size={24}/></div><div className="card-kicker">PRODUCTION WORKSPACE</div><h2>From idea to every frame.</h2><p>Plan episodes, coordinate creative agents, and review your shots in one place as the studio evolves.</p><span className="coming">COMING IN A FUTURE MILESTONE →</span></section><section className="feature-card"><div className="card-icon muted"><FolderOpen size={23}/></div><div className="card-kicker">PROJECT LIBRARY</div><h2>Your stories, organized.</h2><p>Projects, seasons, episodes, characters and assets will live here.</p><span className="coming">PLANNED</span></section></div> : <section className="feature-card placeholder"><Sparkles size={30}/><h2>{page} is coming next.</h2><p>The foundation is intentionally small and ready to grow.</p></section>}
          <div className="status-panel"><div><span className={health.status === "online" ? "dot online" : "dot"}/><strong>Local backend</strong><span className="status-detail">{health.detail}</span></div><button type="button" onClick={refreshHealth}>Check connection</button></div>
        </>}
        </div>
      </main>
    </div>
  );
}
