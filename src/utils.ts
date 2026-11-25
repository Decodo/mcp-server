import { TOOLSET } from './constants';

export { ProgressNotifier, withProgress } from './utils/progress';
export type { ProgressExtra } from './utils/progress';

export const resolveToolsets = (toolsets?: string): TOOLSET[] => {
  if (!toolsets?.trim()) {
    return [];
  }

  return toolsets
    .split(',')
    .map(s => s.trim())
    .filter(Boolean) as TOOLSET[];
};
