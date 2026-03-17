export function getEscalationDisplayText(
  draftValue: string,
  persistedValue: string | null | undefined
): string {
  return draftValue.trim() || persistedValue || "No configurado";
}
