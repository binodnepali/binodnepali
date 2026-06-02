import {
  AccomplishmentProject,
  BirthDate,
  Education,
  Experience,
  Profile,
  Skill,
} from "../../types/Profile.ts";
import {
  formatDuration,
  formatMonthYear,
  formatYearRange,
} from "../../utils/date.ts";
import { formatLanguageEntry } from "../../utils/language.ts";
import { Language } from "../../types/Profile.ts";

const DEFAULT_SITE_ORIGIN = "https://binodnepali.me";

export interface ProfileReadmeOptions {
  siteOrigin?: string;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_\[\]])/g, "\\$1");
}

function yearOfExperience(jobStartDate: BirthDate): number {
  return new Date().getFullYear() - jobStartDate.year;
}

function resolveSummary(summary: string, jobStartDate: BirthDate): string {
  const years = yearOfExperience(jobStartDate);
  return summary.replace("{{year_of_experience}}", String(years));
}

function absoluteAssetUrl(siteOrigin: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const base = siteOrigin.replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function textToMarkdownParagraphs(text: string): string {
  return text.split("\n").map((line) => line.trim()).filter(Boolean).map((
    line,
  ) => escapeMarkdown(line)).join("\n\n");
}

function descriptionToMarkdown(description: string): string {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.every((l) => l.startsWith("- "));
  if (bullets) {
    return lines.map((l) => `- ${escapeMarkdown(l.slice(2))}`).join("\n");
  }
  return escapeMarkdown(description);
}

interface CompanyGroup {
  company: string;
  location: string;
  roles: Experience[];
}

function groupExperiences(experiences: Experience[]): CompanyGroup[] {
  return experiences.reduce<CompanyGroup[]>((acc, exp) => {
    const group = acc.find((g) => g.company === exp.company);
    if (group) {
      group.roles.push(exp);
    } else {
      acc.push({
        company: exp.company,
        location: exp.location,
        roles: [exp],
      });
    }
    return acc;
  }, []);
}

function renderExperience(experiences: Experience[]): string {
  const groups = groupExperiences(experiences);
  const blocks: string[] = [];

  for (const group of groups) {
    const earliest = group.roles[group.roles.length - 1];
    const latest = group.roles[0];
    const duration = formatDuration(earliest.starts_at, latest.ends_at);

    blocks.push(`### ${escapeMarkdown(group.company)}`);
    if (group.location) {
      blocks.push(escapeMarkdown(group.location));
    }
    blocks.push(`*${duration}*`);
    blocks.push("");

    for (const role of group.roles) {
      const dates = `${formatMonthYear(role.starts_at)} – ${
        formatMonthYear(role.ends_at)
      }`;
      blocks.push(`**${escapeMarkdown(role.title)}** · ${dates}`);
      if (role.employment_type) {
        blocks.push(`*${escapeMarkdown(role.employment_type)}*`);
      }
      if (role.description) {
        blocks.push(descriptionToMarkdown(role.description));
      }
      if (role.skills?.length) {
        blocks.push(
          `*Skills:* ${
            role.skills.map((s) => escapeMarkdown(s.trim())).join(", ")
          }`,
        );
      }
      blocks.push("");
    }
  }

  return blocks.join("\n").trimEnd();
}

function renderEducation(educations: Education[]): string {
  return educations.map((edu) => {
    const years = `${edu.starts_at.year} – ${edu.ends_at.year}`;
    const degree = edu.field_of_study
      ? `${edu.degree_name} · ${edu.field_of_study}`
      : edu.degree_name;
    return [
      `### ${escapeMarkdown(edu.school)}`,
      `*${years}*`,
      escapeMarkdown(degree),
      "",
    ].join("\n");
  }).join("\n").trimEnd();
}

function renderProjects(projects: AccomplishmentProject[]): string {
  return projects.map((project) => {
    const dates = formatYearRange(project.starts_at, project.ends_at);
    const lines = [`### ${escapeMarkdown(project.title)}`, `*${dates}*`];
    if (project.description) {
      lines.push(descriptionToMarkdown(project.description));
    }
    return lines.join("\n");
  }).join("\n\n");
}

function skillPills(skills: Skill[]): string {
  return skills.map((s) => `\`${escapeMarkdown(s.name)}\``).join(" ");
}

function renderLanguages(languages: Language[]): string {
  return languages.map((lang) =>
    `- ${escapeMarkdown(formatLanguageEntry(lang))}`
  ).join("\n");
}

export function profileToMarkdown(
  profile: Profile,
  options: ProfileReadmeOptions = {},
): string {
  const siteOrigin = options.siteOrigin ?? DEFAULT_SITE_ORIGIN;
  const picUrl = absoluteAssetUrl(siteOrigin, profile.profile_pic_url);
  const summary = resolveSummary(profile.summary, profile.job_start_date);
  const location = `${profile.city}, ${profile.country_full_name}`;

  const sections: string[] = [
    "<!-- profile-readme:start -->",
    "",
    `<img src="${picUrl}" width="140" height="140" alt="${
      escapeMarkdown(profile.full_name)
    }" align="right" />`,
    "",
    `# ${profile.full_name}`,
    "",
    `**${escapeMarkdown(profile.occupation)}**`,
    "",
    escapeMarkdown(location),
    "",
  ];

  if (profile.headline) {
    sections.push(escapeMarkdown(profile.headline), "");
  }

  sections.push(
    `[**Live CV →**](${siteOrigin}/) · [Email](mailto:${profile.email}) · [LinkedIn](${profile.extra.linkedin_profile_id}) · [GitHub](${profile.extra.github_profile_id})`,
    "",
    "## Summary",
    "",
    textToMarkdownParagraphs(summary),
    "",
  );

  if (profile.experiences.length > 0) {
    sections.push(
      "## Experience",
      "",
      renderExperience(profile.experiences),
      "",
    );
  }

  if (profile.education.length > 0) {
    sections.push("## Education", "", renderEducation(profile.education), "");
  }

  if (profile.accomplishment_projects.length > 0) {
    sections.push(
      "## Projects",
      "",
      renderProjects(profile.accomplishment_projects),
      "",
    );
  }

  if (profile.skills.length > 0) {
    sections.push("## Technical skills", "", skillPills(profile.skills), "");
  }

  const softSkills = profile.soft_skills ?? [];
  if (softSkills.length > 0) {
    sections.push("## Core strengths", "", skillPills(softSkills), "");
  }

  if (profile.languages.length > 0) {
    sections.push(
      "## Languages",
      "",
      renderLanguages(profile.languages),
      "",
    );
  }

  sections.push(
    "---",
    "",
    `Profile README generated from [\`data/linkedin-profile.json\`](data/linkedin-profile.json). Development setup: [CONTRIBUTING.md](CONTRIBUTING.md).`,
    "",
    "<!-- profile-readme:end -->",
  );

  return sections.join("\n").trimEnd() + "\n";
}
