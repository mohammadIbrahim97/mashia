# US03: User Profile Management — Design Spec

**Date:** 2026-04-12
**Story:** G1-US03 (issues #15–#18)
**Scope:** GET /users/me, PATCH /users/me, language validation, unit tests

---

## Endpoints

### GET /api/v1/users/me

- **Guard:** JwtAuthGuard
- **Returns:** ProfileResponseDto — all User fields except `kycDocuments`
- **Purpose:** Client uses this for profile screen, KYC status display, language preference

### PATCH /api/v1/users/me

- **Guard:** JwtAuthGuard
- **Body:** UpdateProfileDto (all fields optional)
  - `fullName` — string, min 1 char
  - `email` — valid email or null
  - `city` — string, min 1 char
  - `preferredLanguage` — enum (ar, tr, en)
- **Not updatable:** phone (identity), country (compliance — locked after registration), role, kycStatus, kycDocuments
- **Returns:** ProfileResponseDto (same shape as GET, reflects updated state)

---

## Response DTO: ProfileResponseDto

Exposes all User fields except `kycDocuments` (S3 keys are internal):

```typescript
{
  id: string;
  role: UserRole;
  fullName: string;
  phone: string;
  email: string | null;
  country: string;
  city: string;
  kycStatus: KycStatus;
  preferredLanguage: PreferredLanguage;
  createdAt: Date;
  updatedAt: Date;
}
```

`kycStatus` is included so the client can render verification badges and prompt KYC upload when needed.

---

## @CurrentUser() Decorator

New parameter decorator at `shared/decorators/current-user.decorator.ts`:

```typescript
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  },
);
```

Extracts `req.user` (set by JwtStrategy). Used in UsersController and available for all future controllers (listings, orders, etc.).

---

## New Files

| File | Purpose |
|------|---------|
| `backend/src/shared/decorators/current-user.decorator.ts` | @CurrentUser() param decorator |
| `backend/src/modules/users/dto/update-profile.dto.ts` | PATCH body — 4 optional fields with class-validator |
| `backend/src/modules/users/dto/profile-response.dto.ts` | Response shape — User minus kycDocuments |
| `backend/src/modules/users/users.controller.spec.ts` | Controller unit tests |

## Modified Files

| File | Change |
|------|--------|
| `backend/src/modules/users/users.controller.ts` | Add GET /me and PATCH /me with JwtAuthGuard + @CurrentUser |
| `backend/src/modules/users/users.service.ts` | Add `updateProfile(userId, dto)` method |
| `backend/src/modules/users/users.service.spec.ts` | Add tests for updateProfile |
| `backend/src/modules/users/users.module.ts` | Add UsersController to controllers array |

---

## Service Method: updateProfile

```
async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User>
```

- Calls `usersRepository.update(userId, dto)` with only the provided fields
- Returns the updated user via `findById(userId)`
- No special error handling needed — user is guaranteed to exist (JwtAuthGuard ensures authenticated user)

---

## Validation Details

**UpdateProfileDto:**
- All fields `@IsOptional()`
- `fullName`: `@IsString()`, `@Length(1, 100)`
- `email`: `@IsEmail()` (class-validator handles null via @IsOptional)
- `city`: `@IsString()`, `@Length(1, 100)`
- `preferredLanguage`: `@IsEnum(PreferredLanguage)` — only ar, tr, en accepted; anything else returns 400

**Empty body:** If all fields are omitted, the update is a no-op. Return current profile unchanged. No special handling needed — TypeORM `update({})` is harmless.

---

## Tests

**UsersController spec (new file):**
1. GET /me returns profile via service.findById
2. PATCH /me calls service.updateProfile and returns result
3. Both endpoints require JwtAuthGuard (guard presence test)

**UsersService spec (existing file, add tests):**
4. updateProfile updates fields and returns updated user
5. updateProfile with empty dto returns user unchanged

**Total new tests:** ~5 tests across 2 suites, bringing project total from 71 to ~76.

---

## Design Decisions

1. **Country locked after registration** — compliance implications (Saudi PDPL, different KYC rules per country). Country changes should go through admin/support flow.
2. **kycDocuments stripped from response** — S3 keys are internal. Client only needs boolean flags (already served by GET /kyc/status).
3. **kycStatus included in profile response** — client needs it for UI state (badges, prompts) without a separate KYC endpoint call.
4. **@CurrentUser() decorator introduced here** — first controller that heavily uses authenticated user. Reused by all future controllers.
5. **No role-based restrictions on profile endpoints** — all authenticated users (seller, buyer, broker) can view and edit their own profile.
