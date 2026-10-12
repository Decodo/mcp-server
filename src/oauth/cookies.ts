export const cookieValue = (header: string | undefined, name: string): string | undefined => {
  if (!header) {
    return;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');

    if (separator === -1) {
      continue;
    }

    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        return;
      }
    }
  }

  return;
};
