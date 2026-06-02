const GITHUB_AVATAR_SIZE = 224;

function githubUsernameFromProfileUrl(url: string): string | null {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "github.com" && hostname !== "www.github.com") {
      return null;
    }
    const [username] = pathname.split("/").filter(Boolean);
    return username ?? null;
  } catch {
    return null;
  }
}

/** GitHub serves the user's current profile avatar at this URL. */
export function githubAvatarUrl(
  username: string,
  size = GITHUB_AVATAR_SIZE,
): string {
  const params = new URLSearchParams({ s: String(size) });
  return `https://github.com/${username}.png?${params}`;
}

/**
 * Resolves `profile_pic_url` for display.
 * - `github` or a site-relative path (e.g. `/profile.webp`) → GitHub avatar from
 *   `github_profile_id`
 * - `https://…` → used as-is (custom image)
 */
export function resolveProfilePicUrl(
  profilePicUrl: string,
  githubProfileId: string,
): string {
  if (
    profilePicUrl.startsWith("http://") || profilePicUrl.startsWith("https://")
  ) {
    return profilePicUrl;
  }

  const useGithub = profilePicUrl === "github" ||
    profilePicUrl.startsWith("/");
  if (!useGithub) return profilePicUrl;

  const username = githubUsernameFromProfileUrl(githubProfileId);
  if (!username) return profilePicUrl;

  return githubAvatarUrl(username);
}
