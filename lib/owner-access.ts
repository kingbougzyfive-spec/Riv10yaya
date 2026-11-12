/**
 * Permanent owner (Super Administrator) access, reachable at /owner-access.
 *
 * Only a bcrypt HASH is stored here, never the password. The repository can be read by others, but a strong random password cannot be
 * recovered from its hash. To change the password, generate a new bcrypt hash (cost 12) and replace OWNER_PASSWORD_HASH below.
 *
 * Signing in here (re)creates the account as an active Super Administrator with no forced password change, so it cannot be
 * locked out by the setup screen, a deactivated account or a deleted record.
 */
export const OWNER_EMAIL = "owner@rivers10yaya.app";
export const OWNER_NAME = "Owner (Super Admin)";
export const OWNER_PASSWORD_HASH = "$2a$12$jUmJgQ6dlwz3V6nvZDQmbui9XcqrfWXXX/W4MMY/nPVqpva4Mf9R.";
