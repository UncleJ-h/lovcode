import { memo } from 'react';
import type { FeatureConfig } from '../../types';
import { FEATURE_ICONS } from '../../constants';

interface FeatureButtonProps {
  feature: FeatureConfig;
  active: boolean;
  onClick: () => void;
  statusIndicator?: 'on' | 'off';
  compact?: boolean;
}

export const FeatureButton = memo(function FeatureButton({
  feature,
  active,
  onClick,
  statusIndicator,
  compact,
}: FeatureButtonProps) {
  const Icon = FEATURE_ICONS[feature.type];
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 ${compact ? 'py-1.5' : 'py-2'} rounded-lg text-left transition-colors ${
        active
          ? 'bg-primary/10 text-primary'
          : feature.available
            ? 'text-ink hover:bg-card-alt'
            : 'text-muted-foreground/60 hover:bg-card-alt'
      }`}
    >
      {Icon && <Icon className="h-5 w-5" />}
      <span className="flex-1 text-sm">
        {feature.label}
        {!feature.available && <span className="ml-1.5 text-xs opacity-60">(TODO)</span>}
      </span>
      {statusIndicator !== undefined && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${statusIndicator === 'on' ? 'bg-primary' : 'bg-muted-foreground/40'}`}
        />
      )}
    </button>
  );
});
