import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Pencil, Plus, RefreshCw, Trash2, Users, Search } from "lucide-react";
import type { Project } from "./projects";
import CharacterReferences from "./CharacterReferences";
import CharacterCover from "./CharacterCover";
import { createCharacter, deleteCharacter, listCharacters, updateCharacter, type Character, type CharacterInput } from "./charactersApi";

const blank: CharacterInput = {
  name: "", role: "supporting", biography: "", personality: "", appearance: "", continuity_notes: "",
};
const fields: { key: keyof CharacterInput; label: string; placeholder: string }[] = [
  { key: "biography", label: "Biography", placeholder: "Origin, motivations, backstory, and key events" },
  { key: "personality", label: "Personality", placeholder: "Temperament, strengths, fears, habits, and values" },
  { key: "appearance", label: "Appearance", placeholder: "Visual identity, distinctive features, hair, eyes, clothing" },
  { key: "continuity_notes", label: "Continuity notes", placeholder: "Details that must remain consistent across scenes" },
];
export default function CharacterLibrary({ project }: { project: Project }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [detailTab, setDetailTab] = useState<"profile" | "appearance" | "continuity" | "references">("profile");
  const [form, setForm] = useState<CharacterInput>({ ...blank });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setCharacters(await listCharacters(project.id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to load characters"); }
    finally { setLoading(false); }
  }, [project.id]);
  useEffect(() => { void refresh(); }, [refresh]);
  function startCreate() {
    setEditingId(null); setForm({ ...blank }); setShowForm(true); setError("");
  }
  function startEdit(character: Character) {
    setEditingId(character.id);
    setForm({
      name: character.name, role: character.role, biography: character.biography,
      personality: character.personality, appearance: character.appearance,
      continuity_notes: character.continuity_notes,
    });
    setShowForm(true); setError("");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim() || !form.role.trim()) {
      setError("Character name and role cannot be blank."); return;
    }
    setSaving(true); setError("");
    try {
      const payload = { ...form, name: form.name.trim(), role: form.role.trim() };
      if (editingId) await updateCharacter(project.id, editingId, payload);
      else await createCharacter(project.id, payload);
      setShowForm(false); setEditingId(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save character"); }
    finally { setSaving(false); }
  }
  async function remove(character: Character) {
    if (deletingId || !window.confirm(`Permanently delete "${character.name}" from this project?`)) return;
    setDeletingId(character.id); setError("");
    try {
      await deleteCharacter(project.id, character.id);
      if (editingId === character.id) { setEditingId(null); setShowForm(false); }
      if (selectedId === character.id) setSelectedId(null);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete character"); }
    finally { setDeletingId(null); }
  }
  const selected = characters.find(c => c.id === selectedId);
  const roles = Array.from(new Set(characters.map(c => c.role))).sort();
  const visible = characters.filter(c => (roleFilter === "all" || c.role === roleFilter) && (c.name.toLowerCase().includes(search.toLowerCase()) || c.role.toLowerCase().includes(search.toLowerCase())));
  return <section className="character-library">
    <div className="project-toolbar character-toolbar">
      <div><div className="eyebrow">CAST & CONTINUITY</div><h2>{selected ? selected.name : "Character Library"}</h2><p>{selected ? selected.role : "Manage characters, continuity and visual references."}</p></div>
      <div className="projects-actions">
        {selected && <button type="button" className="secondary-action" onClick={() => { setSelectedId(null); setShowForm(false); }}><ArrowLeft size={15}/> All characters</button>}
        <button type="button" className="secondary-action" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
        {!selected && <button type="button" className="primary-action" onClick={startCreate}><Plus size={16}/> Add character</button>}
      </div>
    </div>
    {error && <div className="project-error" role="alert">{error}</div>}
    {showForm && <form className="project-form character-form" onSubmit={e => void submit(e)}>
      <div className="project-form-heading"><h2>{editingId ? "Edit character" : "New character"}</h2>
        <button type="button" className="secondary-action" onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
      </div>
      <div className="character-form-grid">
        <label>Character name<input autoFocus required maxLength={160} value={form.name} placeholder="Character name" onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></label>
        <label>Story role<input required maxLength={80} value={form.role} placeholder="e.g. protagonist, antagonist" onChange={e => setForm(f => ({ ...f, role: e.target.value }))}/></label>
      </div>
      {fields.map(({ key, label, placeholder }) => <label key={key}>{label}
        <textarea rows={3} maxLength={10000} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}/>
      </label>)}
      <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save character" : "Create character"}</button>
    </form>}
    {loading ? <div className="project-empty">Loading characters…</div> : selected ? <div className="cinematic-character-detail">
      <div className="character-detail-header"><div><span className="project-type">{selected.role.toUpperCase()}</span><h3>{selected.name}</h3><span className="project-meta">Updated {new Date(selected.updated_at).toLocaleDateString()}</span></div>
        <div className="projects-actions"><button type="button" className="secondary-action" onClick={() => startEdit(selected)}><Pencil size={15}/> Edit</button><button type="button" className="danger-action" disabled={deletingId === selected.id} onClick={() => void remove(selected)}><Trash2 size={15}/> Delete</button></div></div>
      <div className="character-detail-layout"><CharacterCover projectId={project.id} characterId={selected.id}/>
        <div className="character-detail-main">
          <nav className="character-detail-tabs" aria-label="Character detail sections">{([{id:"profile",label:"Profile"},{id:"appearance",label:"Appearance"},{id:"continuity",label:"Continuity"},{id:"references",label:"References"}] as const).map(t => <button key={t.id} type="button" className={detailTab===t.id?"active":""} onClick={() => setDetailTab(t.id)}>{t.label}</button>)}</nav>
          {detailTab==="profile" && <div className="character-info-panel"><h4>Biography</h4><p>{selected.biography || "No biography yet."}</p><h4>Personality</h4><p>{selected.personality || "No personality notes yet."}</p></div>}
          {detailTab==="appearance" && <div className="character-info-panel"><h4>Appearance</h4><p>{selected.appearance || "No appearance details yet."}</p></div>}
          {detailTab==="continuity" && <div className="character-info-panel"><h4>Continuity notes</h4><p>{selected.continuity_notes || "No continuity notes yet."}</p></div>}
          {detailTab==="references" && <CharacterReferences projectId={project.id} characterId={selected.id}/>}
        </div></div>
    </div> : characters.length === 0 ? <div className="project-empty"><Users size={36}/><h2>No characters yet</h2><p>Create your first character to start building your cast.</p><button className="primary-action" type="button" onClick={startCreate}><Plus size={16}/> Create character</button></div> : <>
      <div className="character-filterbar"><label className="character-search"><Search size={16}/><input aria-label="Search characters" placeholder="Search characters…" value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label="Filter by role" value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}><option value="all">All roles</option>{roles.map(role=><option key={role} value={role}>{role}</option>)}</select><span>{visible.length} characters</span></div>
      {visible.length===0 ? <div className="project-empty">No characters match your filters.</div> : <div className="cinematic-character-grid">{visible.map(character=><button type="button" className="cinematic-character-card" key={character.id} onClick={()=>{setSelectedId(character.id);setDetailTab("profile");setShowForm(false);}}>
        <CharacterCover projectId={project.id} characterId={character.id}/><div className="cinematic-character-card-info"><span className="project-type">{character.role.toUpperCase()}</span><h3>{character.name}</h3><p>{character.biography || "Open character profile"}</p></div></button>)}</div>}
    </>}
  </section>;
}
