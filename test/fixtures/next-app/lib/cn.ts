type ClassValue = string | false | null | undefined | Record<string, boolean>;

export function cn(...values: ClassValue[]): string {
  return values
    .flatMap((value) => (value && typeof value === "object" ? Object.keys(value).filter((key) => value[key]) : [value]))
    .filter(Boolean)
    .join(" ");
}
