export type SafetySignal = {
  instagramSessionLost?: boolean;
  instagramRestrictionDetected?: boolean;
  abnormalErrorRate?: boolean;
  optOutRateHigh?: boolean;
  duplicateSpike?: boolean;
  crmInconsistency?: boolean;
  webhookDown?: boolean;
  unexpectedAgentBehavior?: boolean;
  budgetExceeded?: boolean;
};

export function shouldPauseAutomation(signal: SafetySignal): boolean {
  return Object.values(signal).some(Boolean);
}

export function canSendAutomation(params: {
  masterPause: boolean;
  doNotContact: boolean;
  channelLockedByOtherOwner: boolean;
  budgetExceeded: boolean;
  circuitBreakerOpen: boolean;
}): boolean {
  return !params.masterPause && !params.doNotContact && !params.channelLockedByOtherOwner && !params.budgetExceeded && !params.circuitBreakerOpen;
}
