type CompanyLike = { id: string; slug?: string | null };

export function pickPreferredCompanyId(
  companies: CompanyLike[] | null | undefined,
  currentCompanyId?: string | null
): string | null {
  if (!companies?.length) return null;

  if (currentCompanyId && companies.some((company) => company.id === currentCompanyId)) {
    return currentCompanyId;
  }

  return companies.find((company) => company.slug === "talora-base")?.id ?? companies[0]?.id ?? null;
}
