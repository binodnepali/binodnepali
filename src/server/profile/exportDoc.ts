import { Experience, Profile } from "../../types/Profile.ts";
import { normalizeCoverLetterContent } from "../../utils/coverLetter.ts";
import {
  formatDuration,
  formatMonthYear,
  formatYearRange,
} from "../../utils/date.ts";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function descriptionHtml(description: string): string {
  const lines = description.split("\n").map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => l.startsWith("- "));
  if (bullets.length === 0) {
    return `<p>${escapeHtml(description)}</p>`;
  }
  const items = bullets
    .map((l) => `<li>${escapeHtml(l.replace(/^-\s*/, ""))}</li>`)
    .join("");
  return `<ul style="margin:4pt 0 4pt 18pt;padding:0;">${items}</ul>`;
}

interface CompanyGroup {
  company: string;
  location: string;
  roles: Experience[];
}

function groupExperiences(experiences: Experience[]): CompanyGroup[] {
  return experiences.reduce<CompanyGroup[]>((acc, exp) => {
    const group = acc.find((g) => g.company === exp.company);
    if (group) group.roles.push(exp);
    else {
      acc.push({
        company: exp.company,
        location: exp.location,
        roles: [exp],
      });
    }
    return acc;
  }, []);
}

function cvProjects(profile: Profile) {
  return profile.accomplishment_projects.filter((p) =>
    p.include_in_cv !== false
  );
}

function cvSkills(profile: Profile) {
  return profile.skills.filter((s) => s.include_in_cv !== false);
}

function sectionHeading(title: string): string {
  return `<h2 style="font-size:12pt;font-weight:bold;border-bottom:1pt solid #444;margin:16pt 0 8pt 0;padding-bottom:2pt;">${
    escapeHtml(title)
  }</h2>`;
}

function buildExperienceSection(profile: Profile): string {
  const groups = groupExperiences(profile.experiences);
  if (groups.length === 0) return "";

  const entries = groups.map((group) => {
    const earliest = group.roles[group.roles.length - 1];
    const latest = group.roles[0];
    const roles = group.roles.map((role) => {
      const dateRange = `${formatMonthYear(role.starts_at)} – ${
        formatMonthYear(role.ends_at)
      }`;
      const meta = [
        role.employment_type
          ? `<p style="margin:0;font-size:9pt;color:#555;">${
            escapeHtml(role.employment_type)
          }</p>`
          : "",
        role.description ? descriptionHtml(role.description) : "",
        role.skills?.length
          ? `<p style="margin:4pt 0 0 0;font-size:9pt;color:#555;"><b>Skills:</b> ${
            escapeHtml(role.skills.map((s) => s.trim()).join(", "))
          }</p>`
          : "",
      ].join("");

      return `
        <p style="margin:10pt 0 0 0;">
          <b>${escapeHtml(role.title)}</b>
          <span style="float:right;font-size:9pt;color:#555;">${
        escapeHtml(dateRange)
      }</span>
        </p>
        ${meta}`;
    }).join("");

    return `
      <div style="margin-bottom:12pt;">
        <p style="margin:0;">
          <b style="font-size:11pt;">${escapeHtml(group.company)}</b>
          <span style="float:right;font-size:9pt;color:#555;">${
      escapeHtml(formatDuration(earliest.starts_at, latest.ends_at))
    }</span>
        </p>
        ${
      group.location
        ? `<p style="margin:2pt 0 0 0;font-size:9pt;color:#555;">${
          escapeHtml(group.location)
        }</p>`
        : ""
    }
        ${roles}
      </div>`;
  }).join("");

  return sectionHeading("Experience") + entries;
}

function buildEducationSection(profile: Profile): string {
  if (profile.education.length === 0) return "";

  const entries = profile.education.map((education) => `
    <div style="margin-bottom:10pt;">
      <p style="margin:0;">
        <b>${escapeHtml(education.school)}</b>
        <span style="float:right;font-size:9pt;color:#555;">${education.starts_at.year} – ${education.ends_at.year}</span>
      </p>
      <p style="margin:2pt 0 0 0;">${escapeHtml(education.degree_name)}${
    education.field_of_study ? ` · ${escapeHtml(education.field_of_study)}` : ""
  }</p>
    </div>`).join("");

  return sectionHeading("Education") + entries;
}

function buildProjectsSection(profile: Profile): string {
  const projects = cvProjects(profile);
  if (projects.length === 0) return "";

  const entries = projects.map((project) => {
    const dates = formatYearRange(project.starts_at, project.ends_at);
    return `
      <div style="margin-bottom:10pt;">
        <p style="margin:0;">
          <b>${escapeHtml(project.title)}</b>
          <span style="float:right;font-size:9pt;color:#555;">${
      escapeHtml(dates)
    }</span>
        </p>
        ${project.description ? descriptionHtml(project.description) : ""}
      </div>`;
  }).join("");

  return sectionHeading("Projects") + entries;
}

function cvSoftSkills(profile: Profile) {
  return (profile.soft_skills ?? []).filter((s) => s.include_in_cv !== false);
}

function namedSkillList(
  title: string,
  skills: Profile["skills"],
): string {
  if (skills.length === 0) return "";
  const list = skills.map((s) => escapeHtml(s.name.trim())).join(", ");
  return sectionHeading(title) + `<p style="margin:0;">${list}</p>`;
}

function buildSkillsSection(profile: Profile): string {
  return namedSkillList("Technical skills", cvSkills(profile));
}

function buildCoreStrengthsSection(profile: Profile): string {
  return namedSkillList("Core strengths", cvSoftSkills(profile));
}

function buildLanguagesSection(profile: Profile): string {
  if (profile.languages.length === 0) return "";
  const items = profile.languages.map((lang) => {
    const text = escapeHtml(`${lang.name} - ${lang.proficiency}`);
    return `<li style="margin:0 0 4px 0;">${text}</li>`;
  }).join("");
  return sectionHeading("Languages") +
    `<ul style="margin:0;padding-left:1.25em;">${items}</ul>`;
}

export function buildCvWordDocument(profile: Profile): string {
  const yearOfExperience = new Date().getFullYear() -
    profile.job_start_date.year;
  const summary = profile.summary.replace(
    "{{year_of_experience}}",
    `${yearOfExperience}`,
  );

  const contact = [
    `${profile.city}, ${profile.country_full_name}`,
    profile.email,
    stripProtocol(profile.extra.linkedin_profile_id),
    stripProtocol(profile.extra.github_profile_id),
  ].map(escapeHtml).join(" · ");

  const body = [
    `<h1 style="font-size:22pt;margin:0 0 4pt 0;">${
      escapeHtml(profile.full_name)
    }</h1>`,
    `<p style="font-size:13pt;margin:0 0 8pt 0;color:#333;">${
      escapeHtml(profile.occupation)
    }</p>`,
    `<p style="font-size:10pt;margin:0 0 12pt 0;color:#555;">${contact}</p>`,
    sectionHeading("Summary"),
    `<p style="margin:0;white-space:pre-line;">${escapeHtml(summary)}</p>`,
    buildExperienceSection(profile),
    buildEducationSection(profile),
    buildProjectsSection(profile),
    buildSkillsSection(profile),
    buildCoreStrengthsSection(profile),
    buildLanguagesSection(profile),
  ].join("\n");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(profile.full_name)} — CV</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.35; }
  p { margin: 0 0 6pt 0; }
  ul { margin: 4pt 0; }
  li { margin-bottom: 2pt; }
</style>
</head>
<body>${body}</body>
</html>`;
}

export function cvExportFilename(profile: Profile): string {
  const slug = profile.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || "cv"}.doc`;
}

function coverLetterParagraphsHtml(body: string): string {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      `<p style="margin:0 0 12pt 0;text-align:justify;">${escapeHtml(p)}</p>`
    )
    .join("\n");
}

export interface CoverLetterContent {
  salutation?: string;
  body: string;
}

export function buildCoverLetterWordDocument(
  profile: Profile,
  letter: CoverLetterContent,
): string {
  const normalized = normalizeCoverLetterContent(
    letter.salutation,
    letter.body,
  );
  const salutation = normalized.salutation;
  const letterBody = normalized.body;
  const date = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const contact = [
    profile.full_name,
    `${profile.city}, ${profile.country_full_name}`,
    profile.email,
    stripProtocol(profile.extra.linkedin_profile_id),
  ].map(escapeHtml);

  const htmlBody = [
    contact.map((line) => `<p style="margin:0;font-size:11pt;">${line}</p>`)
      .join("\n"),
    `<p style="margin:16pt 0 0 0;font-size:11pt;">${escapeHtml(date)}</p>`,
    `<p style="margin:16pt 0 0 0;font-size:11pt;">${
      escapeHtml(salutation)
    }</p>`,
    coverLetterParagraphsHtml(letterBody),
    `<p style="margin:16pt 0 0 0;font-size:11pt;">Kind regards,</p>`,
    `<p style="margin:8pt 0 0 0;font-size:11pt;">${
      escapeHtml(profile.full_name)
    }</p>`,
  ].join("\n");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${escapeHtml(profile.full_name)} — Cover letter</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #111; line-height: 1.4; }
</style>
</head>
<body>${htmlBody}</body>
</html>`;
}

export function coverLetterExportFilename(
  profile: Profile,
  company?: string,
): string {
  const name = profile.full_name.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "cover-letter";
  const co = company?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(
    /^-+|-+$/g,
    "",
  );
  return co ? `${name}-${co}-cover-letter.doc` : `${name}-cover-letter.doc`;
}
