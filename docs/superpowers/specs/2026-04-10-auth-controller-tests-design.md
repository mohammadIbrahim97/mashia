# G1-US01-07: Auth Controller Unit Tests — Design Spec

**Issue:** #8
**Date:** 2026-04-10
**Status:** Approved

## Overview

Write unit tests for `AuthController` covering all 5 endpoints. The controller is a thin delegation layer — tests verify correct service method calls and return value passthrough.

## Test Setup

- `Test.createTestingModule` with `AuthController` as controller
- Mock `AuthService` with jest fns for: `sendOtp`, `verifyOtp`, `register`, `login`, `refresh`
- `mockUser` fixture matching the User entity (same pattern as `auth.service.spec.ts`)
- Mock token strings: `'mock-access-token'`, `'mock-refresh-token'`

## Test Cases

### sendOtp
1. **Should call authService.sendOtp and return `{ message: 'OTP sent' }`**
   - Input: `{ phone: '+966501234567' }`
   - Verify: `authService.sendOtp` called with `'+966501234567'`
   - Expected return: `{ message: 'OTP sent' }`

### verifyOtp
2. **Should call authService.verifyOtp and return result**
   - Input: `{ phone: '+966501234567', code: '123456' }`
   - Mock: `authService.verifyOtp` returns `{ verified: true, userExists: false }`
   - Verify: called with `('+966501234567', '123456')`
   - Expected return: `{ verified: true, userExists: false }`

### register
3. **Should call authService.register with DTO and return tokens + user**
   - Input: full RegisterDto
   - Mock: `authService.register` returns `{ accessToken, refreshToken, user }`
   - Verify: called with the full DTO object
   - Expected return: tokens + user

### login
4. **Should call authService.login with phone and code, return tokens + user**
   - Input: `{ phone: '+966501234567', code: '123456' }`
   - Mock: `authService.login` returns `{ accessToken, refreshToken, user }`
   - Verify: called with `('+966501234567', '123456')`
   - Expected return: tokens + user

### refresh
5. **Should call authService.refresh with refreshToken, return new pair**
   - Input: `{ refreshToken: 'old-refresh-token' }`
   - Mock: `authService.refresh` returns `{ accessToken, refreshToken }`
   - Verify: called with `'old-refresh-token'`
   - Expected return: new token pair

### Error propagation
6. **Should propagate service errors to caller**
   - Mock: `authService.sendOtp` rejects with `TooManyRequestsException`
   - Verify: controller throws the same exception

## Files

| File | Action |
|---|---|
| `src/modules/auth/auth.controller.spec.ts` | Implement (currently empty scaffold) |

## Not in Scope

- Testing DTO validation (class-validator runs at the NestJS pipe level, not in controller unit tests)
- Testing guards/decorators (those are tested in their own spec files)
- Integration/E2E tests
