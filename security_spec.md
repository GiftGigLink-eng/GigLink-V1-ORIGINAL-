# GigLink V1 Security Specification

## 1. Data Invariants

1. **User Identity Isolation**: A user can only create or update their own User document (`users/{userId}`) and Trust Passport (`trustPassports/{userId}`).
2. **Path Variable Hardening**: Document IDs must satisfy `isValidId(id)` (alphanumeric, dash, underscore, length <= 128).
3. **No Self-Promoted Admin/Verification**: Users cannot set `identityVerified: true` or arbitrarily override verification scores without verification records.
4. **Opportunity Authority**: An Opportunity (`opportunities/{oppId}`) can only be updated or deleted by its creator (`creatorId == request.auth.uid`).
5. **Application Ownership**: Applications (`applications/{appId}`) can only be created by signed-in users setting `applicantId == request.auth.uid`.
6. **PII Protection**: User email and private profile data are restricted to document owner or system.

## 2. Dirty Dozen Security Payloads (Red Team Tests)

1. **Payload 1 (Identity Spoofing)**: Attempting to create `users/victim_uid` with `request.auth.uid = attacker_uid`.
2. **Payload 2 (Ghost Fields)**: Updating `trustPassports/my_uid` with unexpected fields like `isAdmin: true` or `verifiedByGoogle: true`.
3. **Payload 3 (ID Poisoning)**: Creating an opportunity with a 2MB binary string document ID.
4. **Payload 4 (Unbounded String Inflation)**: Attempting to save a 500KB string into `headline` or `bio`.
5. **Payload 5 (State Shortcutting)**: Attempting to set an application status directly to `accepted` without owner consent.
6. **Payload 6 (Timestamp Spoofing)**: Submitting client-side custom timestamps instead of `request.time`.
7. **Payload 7 (Unauthenticated List Query)**: Querying all user profiles without sign-in.
8. **Payload 8 (Opp Listing Overwrite)**: Non-creator attempting to edit another user's opportunity posting.
9. **Payload 9 (Self Verification Injection)**: Setting `identityVerified = true` via client SDK update.
10. **Payload 10 (Null Pointer Exception Exploitation)**: Triggering update checks using `incoming()` in read operations.
11. **Payload 11 (Blanket Read Exploitation)**: Requesting collection reads without `resource.data` restriction.
12. **Payload 12 (Denial of Wallet Attack)**: Performing deep `get()` lookups before basic authentication checks.
