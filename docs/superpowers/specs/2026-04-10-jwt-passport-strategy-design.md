# G1-US01-06: JWT Passport Strategy for Protected Routes — Design Spec

**Issue:** #7
**Date:** 2026-04-10
**Status:** Approved

## Overview

Implement JWT authentication strategy via Passport, plus JwtAuthGuard, RolesGuard, and @Roles() decorator — everything needed to protect routes with role-based access control.

## Components

### JwtStrategy (`src/modules/auth/jwt.strategy.ts`)

Extends `PassportStrategy(Strategy)` from `@nestjs/passport`.

```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
```

**Key details:**
- Extracts token from `Authorization: Bearer <token>` header
- Uses `JWT_SECRET` (access tokens only — refresh tokens use `JWT_REFRESH_SECRET` and are never sent as Bearer)
- `ignoreExpiration: false` — Passport rejects expired tokens before `validate()` runs
- `validate()` receives the decoded payload, looks up user by `sub` (user ID)
- Returns full `User` entity — NestJS attaches it to `request.user`
- Throws `UnauthorizedException` if user no longer exists (deleted after token issued)

**JwtPayload interface:**
```typescript
interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
}
```

### JwtAuthGuard (`src/shared/guards/jwt-auth.guard.ts`)

Thin wrapper around `AuthGuard('jwt')`.

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

**Usage:** `@UseGuards(JwtAuthGuard)` on controllers or individual route handlers.

### RolesGuard (`src/shared/guards/roles.guard.ts`)

Implements `CanActivate`. Reads `@Roles()` metadata and checks `request.user.role`.

```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.role);
  }
}
```

**Key details:**
- If no `@Roles()` metadata → allows access (permissive by default)
- If `@Roles()` set → checks `request.user.role` against allowed roles
- Must be used AFTER `JwtAuthGuard` (needs `request.user` populated)
- Returns `false` (NestJS auto-throws `ForbiddenException`) when role doesn't match

**Usage:** `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.SELLER, UserRole.ADMIN)`

### @Roles() Decorator (`src/shared/decorators/roles.decorator.ts`)

```typescript
export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);
```

Single line. Uses `SetMetadata` from `@nestjs/common`.

## Module Changes

### AuthModule (`src/modules/auth/auth.module.ts`)

- Add `PassportModule` import
- Add `JwtStrategy` to providers

```typescript
@Module({
  imports: [UsersModule, PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, OtpService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

No changes needed to `AppModule` — `AuthModule` is already imported.

## Files

| File | Action |
|---|---|
| `src/modules/auth/jwt.strategy.ts` | Implement (currently empty scaffold) |
| `src/shared/guards/jwt-auth.guard.ts` | Implement (currently empty scaffold) |
| `src/shared/guards/roles.guard.ts` | Implement (currently empty scaffold) |
| `src/shared/decorators/roles.decorator.ts` | Create |
| `src/modules/auth/auth.module.ts` | Modify (add PassportModule + JwtStrategy) |
| `src/modules/auth/jwt.strategy.spec.ts` | Create (tests) |
| `src/shared/guards/roles.guard.spec.ts` | Create (tests) |

## Test Cases

### JwtStrategy (`jwt.strategy.spec.ts`)
1. Should return user when valid payload with existing user ID
2. Should throw UnauthorizedException when user not found (deleted account)

### RolesGuard (`roles.guard.spec.ts`)
3. Should allow access when no @Roles metadata is set
4. Should allow access when user role matches required role
5. Should deny access (return false) when user role doesn't match

### JwtAuthGuard
No dedicated tests — it's a one-line class extending `AuthGuard('jwt')`. Passport's own tests cover it.

### @Roles() Decorator
No dedicated tests — it's a one-line `SetMetadata` call. Tested implicitly via RolesGuard tests.

## Not in Scope

- Applying guards to specific endpoints (that happens when each module implements protected routes)
- Refresh token strategy (refresh tokens are verified manually in `AuthService.refresh()`, not via Passport)
- `@CurrentUser()` decorator for extracting `request.user` cleanly (can add later if desired)
