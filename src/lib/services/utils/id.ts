export function createId(prefix: string): string {
  const randomPart = crypto.randomUUID().split('-')[0];
  return `${prefix}-${randomPart}`;
}
