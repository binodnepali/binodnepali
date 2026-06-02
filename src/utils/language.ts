import { Language } from "../types/Profile.ts";

export function formatLanguageEntry({ name, proficiency }: Language): string {
  return `${name} - ${proficiency}`;
}
