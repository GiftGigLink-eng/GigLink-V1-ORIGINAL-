import React from 'react';

/**
 * @deprecated
 * The chatbox-style IlAssistantDrawer has been formally retired in IL AI V1.
 * In accordance with GigLink's Builder's Principle ("We build systems, not features"),
 * intelligence is now ambient, in-place, and workflow-aware via AmbientContextualGuidance.
 *
 * Arbitrary chat interfaces and persistent floating chat panels have been removed.
 */
export interface IlAssistantDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const IlAssistantDrawer: React.FC<IlAssistantDrawerProps> = () => {
  return null;
};
