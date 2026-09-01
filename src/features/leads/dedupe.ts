export type ExistingLeadIdentity = {
  id: string;
  instagramUsername?: string | null;
  instagramId?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  companyName?: string | null;
};

export type IncomingLeadIdentity = Omit<ExistingLeadIdentity, "id">;

function norm(value?: string | null): string | null {
  return value?.trim().toLowerCase().replace(/^@/, "") || null;
}

export function findDuplicateLead(
  incoming: IncomingLeadIdentity,
  existing: ExistingLeadIdentity[],
): ExistingLeadIdentity | null {
  const fields: Array<keyof IncomingLeadIdentity> = [
    "instagramUsername",
    "instagramId",
    "phone",
    "email",
    "website",
    "companyName",
  ];

  return (
    existing.find((lead) =>
      fields.some((field) => {
        const left = norm(incoming[field]);
        const right = norm(lead[field]);
        return left !== null && right !== null && left === right;
      }),
    ) ?? null
  );
}
