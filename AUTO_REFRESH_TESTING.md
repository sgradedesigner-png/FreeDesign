# Auto-Refresh Testing Guide

## 🧪 1-Minute Quick Test

### Steps:
1. Open unpaid order detail page
2. Open F12 → Console tab
3. Start a 1-minute timer
4. Watch the console

### Expected Console Output:

```
[Auto-refresh] ▶️  Starting auto-refresh (every 10 seconds)
[Auto-refresh] 📊 Order ID: b5b94be6
[Auto-refresh] 💳 Payment Status: UNPAID

Wait 10 seconds...

[Auto-refresh] 🔄 Checking payment status...

Wait 10 seconds...

[Auto-refresh] 🔄 Checking payment status...

Wait 10 seconds...

[Auto-refresh] 🔄 Checking payment status...

... continues every 10 seconds
```

### Expected UI Changes:

```
Initial:
🟢 Автомат шалгалт идэвхтэй (10 сек тутамд)

After 10 seconds:
🟢 Автомат шалгалт идэвхтэй (10 сек тутамд)
   Сүүлд шалгасан: 12:34:10 (1x)

After 20 seconds:
🟢 Автомат шалгалт идэвхтэй (10 сек тутамд)
   Сүүлд шалгасан: 12:34:20 (2x)

After 30 seconds:
🟢 Автомат шалгалт идэвхтэй (10 сек тутамд)
   Сүүлд шалгасан: 12:34:30 (3x)
```

**Result after 60 seconds:**
- Console logs: 6 checks (0s, 10s, 20s, 30s, 40s, 50s)
- UI counter: (5x) or (6x)
- Network tab: 6 API calls

---

## 🧪 Payment Detection Test

### Scenario: User pays during auto-refresh

**Steps:**
1. Open unpaid order page
2. Verify auto-refresh running (see console logs)
3. Pay the order OR manually update database:
   ```sql
   UPDATE orders
   SET paymentStatus = 'PAID',
       status = 'PAID'
   WHERE id = 'b5b94be6-ba60-46c4-bd64-7c600ec9ec95';
   ```
4. Wait up to 10 seconds (for next auto-check)

**Expected Result:**

**Console:**
```
[Auto-refresh] 🔄 Checking payment status...
🎉 Payment detected: UNPAID → PAID
[Auto-refresh] ⏹️  Payment already confirmed - auto-refresh stopped
[Auto-refresh] 🛑 Cleaning up interval
```

**UI:**
- Toast appears: "🎉 Төлбөр амжилттай төлөгдлөө!"
- Payment section changes to green "Paid" card
- Auto-refresh indicator disappears
- No more console logs

**Network Tab:**
- Last API call before payment
- One final API call that detects PAID
- No more calls after that ✅

---

## 🧪 Already-Paid Order Test

### Scenario: User opens already-paid order

**Steps:**
1. Navigate to order that's already PAID
2. Open F12 → Console
3. Wait 30 seconds

**Expected Result:**

**Console:**
```
[Auto-refresh] ⏹️  Payment already confirmed - auto-refresh stopped
```

**UI:**
- Green "Paid" card visible
- NO auto-refresh indicator
- NO counter

**Network Tab:**
- Only 1 initial API call (page load)
- NO auto-refresh calls ✅

---

## 🧪 Multiple Orders Test

### Scenario: Navigate between orders

**Steps:**
1. Open Order A (UNPAID)
2. Verify auto-refresh starts
3. Click "Back to Orders"
4. Click Order B (different UNPAID order)
5. Watch console

**Expected Result:**

**Console:**
```
# Order A loaded
[Auto-refresh] ▶️  Starting auto-refresh (every 10 seconds)
[Auto-refresh] 📊 Order ID: aaaaaaaa

# Navigate away
[Auto-refresh] 🛑 Cleaning up interval

# Order B loaded
[Auto-refresh] ▶️  Starting auto-refresh (every 10 seconds)
[Auto-refresh] 📊 Order ID: bbbbbbbb
```

**Result:**
- Old interval cleaned up ✅
- New interval started ✅
- No memory leak ✅
- Each order has separate counter

---

## 🧪 Manual vs Auto Check Test

### Scenario: Click "Төлвийг шалгах" during auto-refresh

**Steps:**
1. Open unpaid order page
2. Wait for auto-refresh to start
3. Click "Төлвийг шалгах" button immediately

**Expected Result:**

**Console:**
```
[Auto-refresh] 🔄 Checking payment status...  ← Auto (every 10s)
Manual check triggered                        ← Manual (immediate)
[Auto-refresh] 🔄 Checking payment status...  ← Auto (continues)
```

**UI:**
- Toast appears: "⏱️ Төлбөр хүлээгдэж байна..."
- Button shows loading spinner
- Counter continues incrementing
- Auto-refresh NOT affected ✅

**Network Tab:**
- Extra API call from manual check
- Auto-refresh schedule continues normally

---

## 🧪 Browser Tab Switch Test

### Scenario: Switch browser tabs

**Steps:**
1. Open unpaid order page (Tab 1)
2. Verify auto-refresh running
3. Switch to different tab (Tab 2)
4. Wait 30 seconds
5. Switch back to Tab 1

**Expected Result:**

**Tab Active:**
- Auto-refresh runs every 10s ✅
- Console logs continue
- Network requests sent

**Tab Inactive (background):**
- Auto-refresh continues (may slow down due to browser throttling)
- Most browsers throttle to ~1min intervals for background tabs
- This is normal browser behavior

**Tab Re-activated:**
- Auto-refresh resumes normal 10s interval
- Catches up with any missed checks

---

## 📊 Performance Test

### Goal: Verify no memory leaks

**Steps:**
1. Open Chrome DevTools → Performance tab
2. Start recording
3. Open unpaid order page
4. Let auto-refresh run for 2 minutes
5. Stop recording
6. Analyze

**Expected Result:**

**Memory:**
- Heap size: Stable (no continuous growth)
- Intervals: 1 active interval only
- Event listeners: No accumulation

**Network:**
- 12 requests in 2 minutes (0s, 10s, 20s, ..., 110s)
- Consistent timing (exactly 10s apart)
- Response size: ~2-5KB per request

**CPU:**
- Idle most of the time
- Small spike every 10s (fetchOrder execution)
- No excessive re-renders

---

## ✅ Success Criteria

### Auto-refresh is working correctly if:

1. **Console Logs:**
   - [ ] "Starting auto-refresh" appears once
   - [ ] "Checking payment status" every 10 seconds
   - [ ] Stops when payment confirmed
   - [ ] Cleanup on navigation away

2. **UI Indicator:**
   - [ ] Green pulsing dot visible
   - [ ] "Last checked" time updates every 10s
   - [ ] Counter increments (1x, 2x, 3x...)
   - [ ] Disappears when paid

3. **Network Tab:**
   - [ ] API calls exactly 10 seconds apart
   - [ ] Request URL: `/api/orders/{id}`
   - [ ] Status: 200 OK
   - [ ] Stops when PAID

4. **Notifications:**
   - [ ] Auto-refresh: Only notify on payment confirmation
   - [ ] Manual check: Always notify with status
   - [ ] No spam/duplicate notifications

5. **Performance:**
   - [ ] No memory leaks
   - [ ] Only 1 interval running
   - [ ] Cleans up on unmount
   - [ ] No excessive re-renders

---

## 🐛 Troubleshooting

### Problem: No console logs

**Solution:**
```javascript
// Check if order loaded
console.log('Order:', order)
console.log('Payment Status:', order?.paymentStatus)

// Should see:
// Order: { id: '...', paymentStatus: 'UNPAID', ... }
```

### Problem: Logs appear but no API calls

**Solution:**
- Check Network tab filter (remove filters)
- Check fetchOrder() implementation
- Verify API endpoint is correct

### Problem: API calls but no UI update

**Solution:**
- Check if setOrder() is called
- Verify order state updates
- Check React DevTools for state changes

### Problem: Multiple intervals running

**Solution:**
- Check useEffect cleanup
- Verify dependencies array
- May need to add console.log in cleanup function

---

## 📝 Test Checklist (Copy this)

```
□ 1-minute test: 6 checks in 60 seconds
□ Console logs appear correctly
□ UI counter increments
□ Network tab shows API calls
□ Auto-refresh stops when PAID
□ No auto-refresh for already-PAID orders
□ Cleanup on navigation
□ Manual check still works
□ Payment detection works
□ No memory leaks
□ Performance acceptable
```

---

**All tests passing?** ✅ Auto-refresh is working correctly!
**Some tests failing?** 🐛 Share console output for debugging.
