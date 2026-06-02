import { Language } from "../src/types/Profile.ts";
import { formatLanguageEntry } from "../src/utils/language.ts";
import Section from "./cv/Section.tsx";

export default function LanguagesSection(
  { languages }: { languages: Language[] },
) {
  if (languages.length === 0) return null;

  return (
    <Section title="Languages" keepTogether>
      <ul class="flex flex-col gap-1 text-sm text-slate-700 dark:text-slate-200">
        {languages.map((lang) => (
          <li key={lang.name}>{formatLanguageEntry(lang)}</li>
        ))}
      </ul>
    </Section>
  );
}
