import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Plus, RefreshCw, Trash2, Users, UserRound } from "lucide-react";
import type { Project } from "./projects";
import CharacterReferences from "./CharacterReferences";
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
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to delete character"); }
    finally { setDeletingId(null); }
  }
  return <section className="character-library">
    <div className="project-toolbar character-toolbar">
      <div><div className="eyebrow">CAST & CONTINUITY</div><h2>Character Library</h2><p>Keep character identities consistent throughout your production.</p></div>
      <div className="projects-actions">
        <button type="button" className="secondary-action" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15}/> Refresh</button>
        <button type="button" className="primary-action" onClick={startCreate}><Plus size={16}/> Add character</button>
      </div>
    </div>
    {error && <div className="project-error" role="alert">{error}</div>}
    {showForm && <form className="project-form character-form" onSubmit={e => void submit(e)}>
      <div className="project-form-heading"><h2>{editingId ? "Edit character" : "New character"}</h2>
        <button type="button" className="secondary-action" onClick={() => { setShowForm(false); setError(""); }}>Cancel</button>
      </div>
      <div className="character-form-grid">
        <label>Character name<input autoFocus required maxLength={160} value={form.name} placeholder="e.g. Daaki" onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></label>
        <label>Story role<input required maxLength={80} value={form.role} placeholder="e.g. protagonist, antagonist" onChange={e => setForm(f => ({ ...f, role: e.target.value }))}/></label>
      </div>
      {fields.map(({ key, label, placeholder }) => <label key={key}>{label}
        <textarea rows={3} maxLength={10000} placeholder={placeholder} value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}/>
      </label>)}
      <button className="primary-action" type="submit" disabled={saving}>{saving ? "Saving…" : editingId ? "Save character" : "Create character"}</button>
    </form>}
    {loading ? <div className="project-empty">Loading characters…</div> : characters.length === 0 ? <div className="project-empty">
      <Users size={36}/><h2>No characters yet</h2><p>Create your first character to start building your cast.</p>
      <button className="primary-action" type="button" onClick={startCreate}><Plus size={16}/> Create character</button>
    </div> : <div className="character-grid">{characters.map(character => <article className="character-card" key={character.id}>
      <div className="character-card-head"><div className="character-avatar"><UserRound size={26}/></div><div>
        <span className="project-type">{character.role.toUpperCase()}</span><h3>{character.name}</h3>
      </div></div>
      {fields.map(({ key, label }) => character[key] ? <div className="character-detail" key={key}>
        <strong>{label}</strong><p>{character[key]}</p>
      </div> : null)}
      <CharacterReferences projectId={project.id} characterId={character.id}/>
      <div className="project-meta">Updated {new Date(character.updated_at).toLocaleDateString()}</div>
      <div className="projects-actions character-actions">
        <button className="secondary-action" type="button" onClick={() => startEdit(character)}><Pencil size={15}/> Edit</button>
        <button className="danger-action" type="button" disabled={deletingId === character.id} onClick={() => void remove(character)}><Trash2 size={15}/> Delete</button>
      </div>
    </article>)}</div>}
  </section>;
}
