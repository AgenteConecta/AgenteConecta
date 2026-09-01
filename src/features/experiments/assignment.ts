export type ExperimentVariant = {
  id: string;
  weight: number;
};

export function assignVariant(leadId: string, variants: ExperimentVariant[]): ExperimentVariant {
  if (variants.length === 0) {
    throw new Error("At least one variant is required");
  }

  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  const hash = [...leadId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  let bucket = hash % total;

  for (const variant of variants) {
    if (bucket < variant.weight) {
      return variant;
    }
    bucket -= variant.weight;
  }

  return variants[variants.length - 1];
}
