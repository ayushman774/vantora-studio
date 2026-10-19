import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { imageUrl, listReferences } from "./characterReferencesApi";

export default function CharacterCover({ projectId, characterId }: { projectId: string; characterId: string }) {
  const [first, setFirst] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setFirst(null);
    listReferences(projectId, characterId).then(items => {
      if (active && items.length) setFirst(imageUrl(projectId, characterId, items[0].id));
    }).catch(() => { if (active) setFirst(null); });
    return () => { active = false; };
  }, [projectId, characterId]);
  return <div className="character-cover">{first ? <img src={first} alt="Character reference" loading="lazy" /> : <UserRound size={44} aria-label="No reference image" />}</div>;
}
