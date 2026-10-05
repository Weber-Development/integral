export {
  browserStorage,
  type CachedOutcome,
  type CheckOutcome,
  type LicenseStorage,
  memoryStorage,
  type OfflineGraceOptions,
  withOfflineGrace,
} from "./cache.js";
export {
  createEntitlements,
  definePlans,
  EntitlementError,
  type Entitlements,
  type EntitlementsOptions,
  type LimitCheck,
  type PlanDefinition,
  type Plans,
  planFor,
  type ResolvedPlan,
  resolvePlan,
} from "./entitlements.js";
export { generateKeyPair, type KeyPair } from "./keys.js";
export {
  coversRelease,
  decodeLicense,
  LICENSE_PREFIX,
  type LicenseInput,
  signLicense,
  type VerifyOptions,
  verifyLicense,
} from "./license.js";
export { machineId } from "./machine.js";
export {
  REVOCATION_PREFIX,
  type RevocationInput,
  type RevocationList,
  signRevocationList,
  type VerifyRevocationOptions,
  verifyRevocationList,
} from "./revocation.js";
export {
  type LicenseState,
  type LicenseStatus,
  type LicenseStatusOptions,
  licenseStatus,
} from "./status.js";
export type {
  LicenseCustomer,
  LicenseInvalidReason,
  LicensePayload,
  LicenseVerification,
  LimitValue,
} from "./types.js";
