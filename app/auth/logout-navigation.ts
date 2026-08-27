export function isLogoutFormAction(formAction: string | undefined) {
  return formAction != null && new URL(formAction, "https://tripdly.com").pathname === "/logout";
}
