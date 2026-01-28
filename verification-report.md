# JWT Access Token Expiration Test Report
**Subtask:** subtask-3-1 - Test login and verify access token expiration time is 15 minutes
**Date:** 2026-01-28
**Status:** ✅ PASSED

## Test Environment
- API Endpoint: http://localhost:3001
- Environment: Development
- Configuration:
  - JWT_EXPIRES_IN: 15m
  - REFRESH_TOKEN_EXPIRES_IN: 7d

## Test Procedure

### 1. Created Test User
**Request:** POST /api/v1/auth/register
```json
{
  "email": "test@example.com",
  "password": "Password123",
  "fullName": "Test User",
  "companyName": "Test Company",
  "workspaceName": "Test Workspace"
}
```

**Response:** Success (201)
- Returns access token and refresh token
- `expiresIn: 900` (15 minutes in seconds)

### 2. Login Test
**Request:** POST /api/v1/auth/login
```json
{
  "email": "test@example.com",
  "password": "Password123"
}
```

**Response:** Success (200)
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "email": "test@example.com", "fullName": "Test User" },
    "context": {
      "company": { "id": "...", "name": "Test Company", "role": "owner" },
      "workspace": { "id": "...", "name": "Test Workspace", "role": "owner" }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

## Token Verification

### Decoded Access Token Payload
```json
{
  "sub": "cmkxbyvvu001ajzw2aic4onhs",
  "companyId": "cmkxbyvsy0017jzw27inji1r9",
  "workspaceId": "cmkxbyvue0019jzw20v6ny137",
  "companyRole": "owner",
  "workspaceRole": "owner",
  "iat": 1769562822,
  "exp": 1769563722
}
```

### Expiration Analysis
- **Issued At (iat):** 1769562822 (Tue Jan 27 2026 22:13:42 GMT)
- **Expires At (exp):** 1769563722 (Tue Jan 27 2026 22:28:42 GMT)
- **Calculated Expires In:** 900 seconds
- **Calculated Expires In:** 15 minutes

### Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| expiresIn field | 900 seconds | 900 seconds | ✅ PASS |
| Token lifetime (exp - iat) | 900 seconds | 900 seconds | ✅ PASS |
| Token lifetime in minutes | 15 minutes | 15 minutes | ✅ PASS |
| Token is valid | exp > now | true | ✅ PASS |

## Conclusion

✅ **ALL CHECKS PASSED**

The access token expiration time is correctly configured to **15 minutes (900 seconds)**.

### Evidence
1. **Response Field:** The `expiresIn` field in the login response is `900` (15 minutes in seconds)
2. **Token Payload:** The JWT token's `exp` claim is exactly 900 seconds after the `iat` claim
3. **Configuration:** The backend configuration uses `JWT_EXPIRES_IN='15m'`

### Security Benefits
With 15-minute access tokens:
- Reduced window of opportunity for stolen tokens
- Improved security posture
- Refresh token rotation provides seamless user experience
- Compromised access tokens expire quickly, limiting damage

## Next Steps
- Complete subtask-3-2: Test token refresh flow and verify proactive refresh works
- Complete subtask-3-3: Verify refresh token lifetime is 7 days
