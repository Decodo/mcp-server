export type TrustProxy = boolean | number | string;

export const trustProxyFromEnv = (value: string | undefined): TrustProxy => {
  const trimmed = value?.trim() ?? '';

  if (!trimmed || trimmed === 'false') {
    return false;
  }

  if (trimmed === 'true') {
    return true;
  }

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }

  return trimmed;
};
