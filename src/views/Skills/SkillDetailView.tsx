import { invoke } from "@tauri-apps/api/core";
import type { LocalSkill } from "../../types";
import { DetailHeader, ContentCard, ConfigPage } from "../../components/config";

interface SkillDetailViewProps {
  skill: LocalSkill;
  onBack: () => void;
}

export function SkillDetailView({ skill, onBack }: SkillDetailViewProps) {
  return (
    <ConfigPage>
      <DetailHeader
        title={skill.name}
        description={skill.description}
        backLabel="Skills"
        onBack={onBack}
        path={skill.path}
        onOpenPath={(p) => invoke("open_in_editor", { path: p })}
      />
      <div className="space-y-4">
        <ContentCard label="Content" content={skill.content} />
      </div>
    </ConfigPage>
  );
}
