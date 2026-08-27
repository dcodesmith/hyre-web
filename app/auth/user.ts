export type User = {
  email: string;
  name: string | null;
};

export function getUserInitials(user: User): string {
  const nameParts = user.name
    ?.trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (nameParts != null && nameParts.length > 1) {
    const lastPart = nameParts.at(-1);
    return `${nameParts[0][0]}${lastPart?.[0] ?? ""}`.toUpperCase();
  }

  if (nameParts != null && nameParts.length > 0) {
    return nameParts[0][0].toUpperCase();
  }

  const emailInitial = user.email.trim().charAt(0);
  return emailInitial ? emailInitial.toUpperCase() : "U";
}
