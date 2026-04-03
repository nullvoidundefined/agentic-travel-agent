'use client';

import type { ChatNodeOfType } from '@agentic-travel-agent/shared-types';

import { ExperienceCard } from '../widgets/ExperienceCard';
import { SelectableCardGroup } from '../widgets/SelectableCardGroup';

interface ExperienceTilesProps {
  node: ChatNodeOfType<'experience_tiles'>;
  onConfirm?: (label: string) => void;
  disabled?: boolean;
  confirmedId?: string | null;
}

export function ExperienceTiles({
  node,
  onConfirm,
  disabled,
  confirmedId,
}: ExperienceTilesProps) {
  const items = node.experiences.map((experience) => ({
    id: experience.id,
    label: experience.name,
    node: (selected: boolean, onClick: () => void) => (
      <ExperienceCard
        name={experience.name}
        category={experience.category ?? null}
        photoRef={experience.photo_ref ?? null}
        rating={experience.rating ?? null}
        estimatedCost={experience.estimated_cost}
        latitude={experience.lat ?? null}
        longitude={experience.lon ?? null}
        selected={selected}
        onClick={onClick}
      />
    ),
  }));

  if (!node.selectable) {
    return (
      <div
        style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}
      >
        {node.experiences.map((experience) => (
          <ExperienceCard
            key={experience.id}
            name={experience.name}
            category={experience.category ?? null}
            photoRef={experience.photo_ref ?? null}
            rating={experience.rating ?? null}
            estimatedCost={experience.estimated_cost}
            latitude={experience.lat ?? null}
            longitude={experience.lon ?? null}
          />
        ))}
      </div>
    );
  }

  return (
    <SelectableCardGroup
      items={items}
      onConfirm={onConfirm ?? (() => {})}
      disabled={disabled}
      confirmedId={confirmedId}
    />
  );
}
