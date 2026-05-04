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

export const removeKeyFromNestedObject = ({
  obj,
  keyToRemove,
}: {
  obj: object;
  keyToRemove: string;
}): object => {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeKeyFromNestedObject({ obj: item, keyToRemove }));
  }

  const record = obj as Record<string, unknown>;
  const newObj: Record<string, unknown> = {};

  for (const key in record) {
    if (key === keyToRemove) {
      continue;
    }

    newObj[key] = removeKeyFromNestedObject({ obj: record[key] as object, keyToRemove });
  }

  return newObj;
};
