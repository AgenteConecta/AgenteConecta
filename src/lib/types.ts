export type LeadType = "learner" | "professional" | "business" | "unknown";
export type MarketAwareness =
  | "unaware"
  | "problem_aware"
  | "automation_aware"
  | "solution_aware"
  | "professional_integrator"
  | "competing_solution_user";
export type GeographyTier = "tier_1" | "tier_2" | "tier_3";
export type ProjectReadiness =
  | "none"
  | "future"
  | "planning"
  | "active_project"
  | "urgent_project"
  | "unknown";
export type ChannelOwner = "browser" | "meta_api" | "whatsapp" | "human" | "none";
export type AppMode = "simulation" | "dry_run" | "pilot" | "production";

export type Intent =
  | "interested"
  | "asked_training"
  | "asked_credentialing"
  | "asked_price"
  | "asked_kit"
  | "asked_products"
  | "asked_representation"
  | "has_project"
  | "has_customer"
  | "uses_competitor"
  | "wants_whatsapp"
  | "has_cnpj"
  | "no_cnpj"
  | "not_owner"
  | "will_forward"
  | "objection"
  | "not_interested"
  | "opt_out"
  | "ambiguous"
  | "needs_human";

export type AgentAction =
  | "reply"
  | "ask_question"
  | "qualify"
  | "present_company"
  | "present_training"
  | "present_credentialing"
  | "explore_business"
  | "explore_existing_projects"
  | "explore_current_solution"
  | "present_portfolio_opportunity"
  | "send_whatsapp_handoff"
  | "schedule_followup"
  | "wait"
  | "close"
  | "escalate_human";

export type TrainingStage =
  | "discovered"
  | "qualified"
  | "contacted"
  | "replied"
  | "profile_identified"
  | "training_interest"
  | "whatsapp_handoff"
  | "offer_presented"
  | "checkout_started"
  | "student"
  | "training_completed"
  | "closed";

export type CredentialingStage =
  | "discovered"
  | "qualified"
  | "contacted"
  | "replied"
  | "business_identified"
  | "credentialing_interest"
  | "business_qualification"
  | "whatsapp_handoff"
  | "credentialing_offer_presented"
  | "training_started"
  | "certification_pending"
  | "certification_passed"
  | "cnpj_pending"
  | "credentialed"
  | "first_order"
  | "active_reseller"
  | "closed";

export type LeadProfileInput = {
  instagramUsername: string;
  displayName?: string;
  bio?: string;
  category?: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  posts?: string[];
  followers?: number;
  discoverySource?: string;
  discoveryKeyword?: string;
};

export type ScoreContribution = {
  label: string;
  points: number;
};

export type LeadScoreResult = {
  rawLeadScore: number;
  leadScore: number;
  commercialValueScore: number;
  leadType: LeadType;
  marketAwareness: MarketAwareness;
  geographyTier: GeographyTier;
  territoryOpportunityScore: number;
  projectReadiness: ProjectReadiness;
  businessType: string;
  estimatedRole: string;
  scoreExplanation: ScoreContribution[];
  commercialExplanation: ScoreContribution[];
};

export type BusinessConfig = {
  owner: {
    name: string;
    role: string;
    company: string;
  };
  company: {
    name: string;
    website: string;
    trainingWebsite: string;
    country: string;
  };
  channels: {
    instagram: {
      handle: string;
      url: string;
    };
    whatsapp: {
      number: string;
      provider: "evolution";
    };
  };
  offers: {
    basicTraining: {
      name: string;
      priceBRL: number;
      credentialing: false;
    };
    credentialing: {
      name: string;
      priceBRL: number;
      credentialing: true;
      requirements: string[];
    };
  };
  priorityStates: string[];
  secondaryStates: string[];
  primarySegments: string[];
  centralizedAutomationKeywords: string[];
  complementarySegments: string[];
  territoryOpportunityDefaults: Record<GeographyTier, number>;
  safetyLimits: {
    MAX_DMS_PER_DAY: number;
    MIN_SECONDS_BETWEEN_DMS: number;
    MAX_SECONDS_BETWEEN_DMS: number;
    OPERATING_HOURS: string;
    OPERATING_TIMEZONE: string;
    WARMUP_ENABLED: boolean;
    MAX_FOLLOWUPS: number;
  };
  kit: {
    name: string;
    priceBRL: number | null;
    composition: string[];
  };
};
