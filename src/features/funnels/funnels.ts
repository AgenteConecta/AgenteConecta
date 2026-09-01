import type { CredentialingStage, TrainingStage } from "@/lib/types";

export const trainingStages: TrainingStage[] = [
  "discovered",
  "qualified",
  "contacted",
  "replied",
  "profile_identified",
  "training_interest",
  "whatsapp_handoff",
  "offer_presented",
  "checkout_started",
  "student",
  "training_completed",
  "closed",
];

export const credentialingStages: CredentialingStage[] = [
  "discovered",
  "qualified",
  "contacted",
  "replied",
  "business_identified",
  "credentialing_interest",
  "business_qualification",
  "whatsapp_handoff",
  "credentialing_offer_presented",
  "training_started",
  "certification_pending",
  "certification_passed",
  "cnpj_pending",
  "credentialed",
  "first_order",
  "active_reseller",
  "closed",
];

export function moveTrainingStage(current: TrainingStage, target: TrainingStage): TrainingStage {
  return trainingStages.indexOf(target) >= trainingStages.indexOf(current) ? target : current;
}

export function moveCredentialingStage(current: CredentialingStage, target: CredentialingStage): CredentialingStage {
  return credentialingStages.indexOf(target) >= credentialingStages.indexOf(current) ? target : current;
}
