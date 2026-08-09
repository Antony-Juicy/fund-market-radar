export const shouldPreferStaticData = (hostname: string): boolean =>
  hostname.toLowerCase().endsWith(".github.io");
