# Upload Journey Rollout Checklist

## Phase 2 Upload Features - Release Gate

This checklist must be completed and signed off before enabling upload features for public use.

---

## Pre-Deployment Checklist

### Database & Infrastructure

- [ ] **Migration Applied**: `20260215180000_phase2_upload_lifecycle` applied to production
- [ ] **RLS Policies**: Upload asset RLS policies verified (users see own, admins see all)
- [ ] **Indexes**: Performance indexes created on `upload_assets`, `upload_validation_jobs`
- [ ] **Cloudinary**: Production Cloudinary credentials configured in env
- [ ] **Environment Variables**: All upload-related env vars set in Railway/production
  - [ ] `CLOUDINARY_CLOUD_NAME`
  - [ ] `CLOUDINARY_API_KEY`
  - [ ] `CLOUDINARY_API_SECRET`
  - [ ] `WORKER_UPLOAD_VALIDATION_ENABLED=true`
  - [ ] `WORKER_UPLOAD_VALIDATION_POLL_INTERVAL_MS=5000`
  - [ ] `WORKER_UPLOAD_VALIDATION_BATCH_SIZE=10`
  - [ ] `WORKER_UPLOAD_VALIDATION_MAX_CONCURRENCY=5`

### Backend Services

- [ ] **Upload Validation Worker**: Running in production (check logs for polling)
- [ ] **Worker Health**: No dead-letter jobs accumulating in queue
- [ ] **API Endpoints**: All upload endpoints responding (sign, complete, status)
- [ ] **Admin Moderation**: Admin upload queue accessible
- [ ] **Rate Limiting**: Upload endpoints rate-limited appropriately
- [ ] **Error Handling**: Graceful degradation for Cloudinary API failures

### Frontend

- [ ] **Upload UI**: Gang upload strategy renders correctly
- [ ] **UV Disclaimer**: UV hard-surface warnings displayed
- [ ] **Validation Polling**: Status polling works (3s interval, 20 max attempts)
- [ ] **Error States**: Upload failure messages user-friendly
- [ ] **Add-to-Cart Guard**: Users cannot add unvalidated uploads to cart
- [ ] **Checkout Flow**: Upload references preserved through checkout
- [ ] **Order Detail**: Uploaded files visible in order history

---

## Testing Checklist

### Backend Tests

- [ ] **Unit Tests**: `upload-validation-worker.test.ts` passing
- [ ] **Integration Tests**: `admin-upload-moderation.test.ts` passing
- [ ] **Validation Logic**: All upload family constraints tested
  - [ ] DTF Gang Upload (50MB, 150 DPI, 1200px min)
  - [ ] UV Gang Upload (50MB, 150 DPI, 1200px min)
  - [ ] By Size (20MB, no DPI requirement)
  - [ ] UV By Size (20MB, no DPI requirement)
- [ ] **Exponential Backoff**: Retry delays verified (1s → 2s → 4s → 8s)
- [ ] **Dead Letter**: Failed jobs move to dead-letter after 3 retries

### Frontend E2E Tests (Manual)

**DTF Gang Upload Flow:**
- [ ] Navigate to gang upload product
- [ ] Select gang sheet length (30/50/70/100cm)
- [ ] Upload valid PNG file
- [ ] Status changes: pending → processing → passed
- [ ] Add to cart enabled after validation passes
- [ ] Cart shows upload file name and length
- [ ] Checkout preserves upload reference
- [ ] Order detail shows uploaded file

**UV Gang Upload Flow:**
- [ ] Navigate to UV gang upload product
- [ ] UV hard-surface disclaimer visible
- [ ] Upload valid file
- [ ] Validation passes
- [ ] Add to cart works
- [ ] Checkout succeeds

**Error Scenarios:**
- [ ] Upload oversized file (>50MB) → validation fails with clear message
- [ ] Upload invalid format (ZIP) → rejected immediately
- [ ] Upload during Cloudinary outage → retry mechanism works
- [ ] Attempt add-to-cart before validation → button disabled with tooltip

### Admin Moderation Tests

- [ ] **Queue Access**: Admin can access moderation queue at `/moderation`
- [ ] **Filter by Status**: Pending/Approved/Rejected filters work
- [ ] **Filter by Family**: Gang/UV/BySize filters work
- [ ] **Detail View**: Full upload info visible (dimensions, DPI, validation errors)
- [ ] **Approve Action**: Creates audit trail, updates status
- [ ] **Reject Action**: Requires reason (min 3 chars), creates audit
- [ ] **Flag Action**: Moves to flagged status for supervisor review
- [ ] **Audit History**: All moderation actions visible with timestamps

---

## Performance & Reliability

### Load Testing

- [ ] **Concurrent Uploads**: System handles 10 concurrent uploads
- [ ] **Queue Throughput**: Worker processes 100 jobs in <60 seconds
- [ ] **Database Load**: No N+1 queries in upload endpoints
- [ ] **Cloudinary Quota**: Usage within plan limits (monitor for 7 days)

### Error Recovery

- [ ] **Worker Crash**: Worker restarts automatically (Railway restart policy)
- [ ] **Database Timeout**: Upload API returns 503 with retry header
- [ ] **Cloudinary 429**: Rate limit handled gracefully with exponential backoff
- [ ] **Orphaned Jobs**: No jobs stuck in PROCESSING for >10 minutes

### Monitoring

- [ ] **Error Tracking**: Sentry capturing upload errors
- [ ] **Worker Logs**: Validation worker logs visible in Railway
- [ ] **Queue Metrics**: Dead-letter count monitored
- [ ] **Upload Success Rate**: >95% validation pass rate (baseline)

---

## Security Checklist

- [ ] **Signed Uploads**: All uploads require server-signed params
- [ ] **MIME Validation**: Server validates MIME type matches extension
- [ ] **File Size Limits**: Hard limits enforced server-side (not just client)
- [ ] **Moderation Required**: Explicit moderation action required for production use
- [ ] **RLS Enforcement**: Users cannot access others' uploads via API
- [ ] **Admin Routes**: All moderation endpoints protected by admin guard
- [ ] **Audit Immutability**: Moderation actions cannot be deleted/edited

---

## Rollout Strategy

### Phase 1: Internal Testing (Week 1)

- [ ] Enable for internal team only (allowlist by email)
- [ ] Test all upload families with real files
- [ ] Monitor error rates and validation accuracy
- [ ] Collect feedback on UX flow

**Feature Flag:**
```env
FF_UPLOAD_ASYNC_VALIDATION_V1=internal_only
UPLOAD_ALLOWLIST_EMAILS=team@koreangoods.mn,admin@koreangoods.mn
```

### Phase 2: Limited Beta (Week 2-3)

- [ ] Enable for 50 beta testers
- [ ] Monitor Cloudinary usage and costs
- [ ] Track conversion rate (upload → validation → purchase)
- [ ] Address any UX friction points

**Feature Flag:**
```env
FF_UPLOAD_ASYNC_VALIDATION_V1=beta
UPLOAD_BETA_USER_LIMIT=50
```

### Phase 3: Public Rollout (Week 4+)

- [ ] Enable for all users
- [ ] Monitor error rates daily for first week
- [ ] Run backup validation job to catch missed validations
- [ ] Prepare rollback plan (disable feature flag)

**Feature Flag:**
```env
FF_UPLOAD_ASYNC_VALIDATION_V1=enabled
```

---

## Rollback Plan

If critical issues arise, disable upload features immediately:

1. **Set Feature Flag**: `FF_UPLOAD_ASYNC_VALIDATION_V1=disabled`
2. **Stop Worker**: Set `WORKER_UPLOAD_VALIDATION_ENABLED=false`
3. **Notify Users**: Display banner: "Upload features temporarily unavailable"
4. **Preserve Data**: Do not delete upload_assets table
5. **Investigate**: Review Sentry errors and worker logs
6. **Fix & Redeploy**: Address root cause before re-enabling

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **Backend Lead** | ________________ | ____/____/2026 | ________________ |
| **Frontend Lead** | ________________ | ____/____/2026 | ________________ |
| **DevOps** | ________________ | ____/____/2026 | ________________ |
| **Product Manager** | ________________ | ____/____/2026 | ________________ |
| **QA Lead** | ________________ | ____/____/2026 | ________________ |

---

## Post-Rollout Monitoring (First 30 Days)

### Week 1
- [ ] Daily error rate review (<1% target)
- [ ] Worker health check (no dead-letter buildup)
- [ ] User feedback collection

### Week 2-4
- [ ] Weekly Cloudinary cost review
- [ ] Validation accuracy audit (sample 100 uploads)
- [ ] Customer support ticket analysis (upload-related)

### Metrics to Track
- Upload success rate (target: >95%)
- Validation pass rate (baseline: establish first week)
- Time to validation (target: <10 seconds p95)
- Dead-letter rate (target: <0.5%)
- Cart conversion with uploads (compare to non-upload products)

---

## Known Limitations & Future Work

- **E2E Tests**: Playwright tests for upload journey not yet automated (P2-08 manual testing only)
- **Async Timing**: Validation polling may timeout in slow network conditions (5-minute max)
- **Moderation Queue**: No auto-approve for trusted users (all uploads require manual review initially)
- **Rollback Complexity**: Disabling feature mid-session may orphan in-progress uploads

**Planned for Phase 3:**
- Automated E2E tests with mocked Cloudinary
- Smart validation (auto-approve for repeat uploaders with good history)
- Real-time validation webhooks (reduce polling)
- Upload preview thumbnails in moderation queue

---

**Document Version:** 1.0
**Last Updated:** February 15, 2026
**Owner:** Engineering Team
