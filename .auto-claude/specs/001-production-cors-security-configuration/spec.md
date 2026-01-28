# Production CORS Security Configuration

Implement proper CORS configuration using CHROME_EXTENSION_ID environment variable to secure API access from the Chrome extension in production. Ensure only the official extension can communicate with the API.

## Rationale
Critical security requirement for production deployment. Current development mode allows all chrome-extension:// origins which is a security vulnerability. Must be secured before public launch.

## User Stories
- As a security-conscious developer, I want CORS properly configured so that only authorized extensions can access the API
- As a user, I want the extension to work reliably in production without CORS errors

## Acceptance Criteria
- [ ] CHROME_EXTENSION_ID environment variable is documented in deployment guide
- [ ] API validates extension origin in production mode
- [ ] Only the official extension ID can access API endpoints
- [ ] Development mode still allows localhost origins for testing
- [ ] CORS errors no longer occur in production environment
