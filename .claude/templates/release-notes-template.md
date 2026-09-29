# Release Notes Template

## [Version X.Y.Z] - YYYY-MM-DD

### 🎉 New Features
- **Feature Name**: Brief description of what it does and why it's valuable.
  - *User Impact*: How this benefits users
  - *Technical Details*: Implementation notes (for internal teams)

### 🐛 Bug Fixes
- **Issue #123**: Fixed login redirect issue
  - *Root Cause*: Session cookie was not being set correctly
  - *Resolution*: Updated middleware to properly handle cookie domain

### 🚀 Improvements
- **Performance**: Reduced API response time by 60% (p95: 450ms → 180ms)
  - Added database indexes
  - Implemented Redis caching
- **UX**: Improved dashboard loading experience
  - Added skeleton loaders
  - Implemented progressive rendering

### 🔄 Changes
- **API**: Updated user endpoint response format (v2)
  - *Breaking Change*: `name` field split into `firstName` and `lastName`
  - *Migration Guide*: See [API v1 → v2 migration guide](./docs/migration-v1-to-v2.md)

### 🔒 Security
- Updated dependencies to address security vulnerabilities
- Implemented rate limiting on login endpoint
- Added CSRF protection for form submissions

### 🗃️ Database
- **Migration Required**: Yes
- **Downtime**: None (zero-downtime migration)
- **Rollback**: Automatic rollback script available

### 📦 Dependencies
- Upgraded `@nestjs/core` from v9.4.0 to v10.3.0
- Upgraded `react-query` from v3.39.3 to v4.29.5
- Removed deprecated `lodash` (replaced with native JS methods)

### 🧪 Testing
- Added 45 new unit tests (coverage: 78% → 85%)
- Added integration tests for new user endpoints
- Performance tests validate p95 < 200ms

### 📚 Documentation
- Updated API documentation (OpenAPI spec v2.1.0)
- Added new guides:
  - [User Authentication Flow](./docs/auth-flow.md)
  - [Caching Strategy](./docs/caching.md)

### ⚠️ Known Issues
- Dashboard chart may not render correctly in Safari 15 (fix in progress)
- Email notifications delayed during peak traffic (investigating)

### 🔮 Upcoming
- Next Release (v1.3.0) planned for 2024-02-01
- Planned features:
  - Advanced search with filters
  - Bulk user import
  - Two-factor authentication

### 📞 Support
- Report issues: [GitHub Issues](https://github.com/your-org/your-repo/issues)
- Contact: support@example.com

---

## Migration Guide (if applicable)

### Breaking Changes

#### API v1 → v2: User Endpoint
**Old Response:**
```json
{
  "id": "123",
  "name": "John Doe",
  "email": "john@example.com"
}
```

**New Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com"
}
```

**Action Required:**
1. Update API client to use `/api/v2/users` base URL
2. Update `User` type definitions
3. Handle `firstName`/`lastName` fields instead of `name`

### Database Migration

**Schema Changes:**
- Added `User.firstName` (TEXT)
- Added `User.lastName` (TEXT)
- Deprecated `User.name` (will be removed in v2.0.0)

**Data Migration:**
- Existing `name` values automatically split into `firstName`/`lastName`
- Single-name users: `firstName = lastName = name`

**Rollback:**
- Automatic rollback available if issues detected
- Rollback script: `npm run migrate:rollback`

---

## Deployment Notes

### Pre-Deployment
1. Create database backup
2. Review migration plan
3. Notify stakeholders of deployment window

### Deployment
1. Apply database migrations: `npx prisma migrate deploy`
2. Deploy API: `npm run deploy:api`
3. Deploy Web: `npm run deploy:web`
4. Invalidate CDN cache (if needed)

### Post-Deployment
1. Run smoke tests
2. Monitor CloudWatch logs
3. Verify metrics (error rate, latency)

### Rollback (if needed)
1. Revert deployment: `npm run deploy:rollback`
2. Revert migrations: `npm run migrate:rollback`
3. Notify stakeholders
