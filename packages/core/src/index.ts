export {
  ACTIVATION_PREFIX,
  type ActivationRequest,
  type ActivationRequestInput,
  type BindOptions,
  type BindResult,
  bindLicense,
  createActivationRequest,
  readActivationRequest,
  type UpgradeOptions,
  type UpgradeResult,
  upgradeLicense,
} from "./activation.js";
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
export {
  type Algorithm,
  ecdsaDerToRaw,
  generateKeyPair,
  type KeyPair,
  P256_PREFIX,
  publicKeyAlgorithm,
  publicKeyFromPrivateKey,
  type Signer,
  type SigningKey,
} from "./keys.js";
export {
  coversRelease,
  decodeLicense,
  LEGACY_LICENSE_PREFIX,
  LICENSE_PREFIX,
  type LicenseInput,
  type SignOptions,
  signLicense,
  type VerifyOptions,
  verifyLicense,
} from "./license.js";
export { machineId } from "./machine.js";
export {
  LEGACY_REVOCATION_PREFIX,
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
export type { PublicKeys } from "./token.js";
export type {
  LicenseCustomer,
  LicenseInvalidReason,
  LicensePayload,
  LicenseVerification,
  LimitValue,
} from "./types.js";
