export function resolveNavbarAdminUiState(
  serverIsAdmin: boolean,
  metadataRole: unknown,
) {
  return serverIsAdmin || metadataRole === "ADMIN";
}
