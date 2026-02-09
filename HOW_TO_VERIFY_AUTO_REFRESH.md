# Auto-Refresh Verification Guide

## 🔍 How to Verify 10-Second Auto-Refresh is Working

### Method 1: Browser DevTools Network Tab (Easiest)

**Steps:**
1. Open order detail page with unpaid order
2. Press `F12` or `Ctrl+Shift+I` to open DevTools
3. Go to **Network** tab
4. Filter by: `orders` or `/api/orders/`
5. Watch for API calls

**Expected Result:**
```
Time    Request                                  Status
00:00   GET /api/orders/b5b94be6-ba60-46c4      200 OK
00:10   GET /api/orders/b5b94be6-ba60-46c4      200 OK  ← Auto-refresh!
00:20   GET /api/orders/b5b94be6-ba60-46c4      200 OK  ← Auto-refresh!
00:30   GET /api/orders/b5b94be6-ba60-46c4      200 OK  ← Auto-refresh!
```

**What to Look For:**
- ✅ Request every 10 seconds (not 9s, not 11s - exactly 10s)
- ✅ Request URL: `/api/orders/{orderId}`
- ✅ Status: 200 OK
- ✅ Stops when payment confirmed (paymentStatus changes to PAID)

---

### Method 2: Browser Console Logs

**Steps:**
1. Open order detail page
2. Press `F12` → Go to **Console** tab
3. Watch for log messages

**Expected Console Output:**
```
[Auto-refresh] Checking payment status... (10s interval)
[Auto-refresh] Payment still UNPAID
[Auto-refresh] Checking payment status... (10s interval)
[Auto-refresh] Payment still UNPAID
[Auto-refresh] Checking payment status... (10s interval)
[Auto-refresh] Payment CONFIRMED! Stopping auto-refresh.
```

---

### Method 3: Visual Indicator (Added Below)

We'll add a small visual indicator showing:
- Last checked time
- Next check in X seconds
- Number of checks performed

---

## 🐛 Common Issues

### Issue 1: Auto-refresh Not Starting
**Symptoms:** No API calls in Network tab

**Possible Causes:**
1. Order is already PAID (auto-refresh only works for UNPAID)
2. Order object not loaded yet
3. useEffect dependencies issue

**Solution:**
- Check `order.paymentStatus` in console: `console.log(order.paymentStatus)`
- Should be `"UNPAID"` for auto-refresh to start

### Issue 2: Multiple Intervals Running
**Symptoms:** Too many API calls (< 10s intervals)

**Possible Causes:**
- Component re-rendering creating multiple intervals
- useEffect cleanup not working

**Solution:**
- Check Network tab for request frequency
- Should be exactly 10s between requests

### Issue 3: Auto-refresh Not Stopping After Payment
**Symptoms:** Continues checking even after PAID

**Possible Causes:**
- useEffect dependency not detecting paymentStatus change

**Solution:**
- Check if `order.paymentStatus` updates to `"PAID"`
- Interval should clear when status changes

---

## 🧪 Manual Testing Checklist

### Test 1: Auto-refresh Starts
- [ ] Open unpaid order page
- [ ] Open DevTools Network tab
- [ ] Wait 10 seconds
- [ ] See API call to `/api/orders/{id}`
- [ ] Wait another 10 seconds
- [ ] See another API call (exactly 10s later)

### Test 2: Auto-refresh Stops When Paid
- [ ] Open unpaid order page
- [ ] Confirm auto-refresh is running (Network tab)
- [ ] Pay the order (or manually update DB: `UPDATE orders SET paymentStatus='PAID' WHERE id='...'`)
- [ ] Wait for next auto-refresh (max 10s)
- [ ] See toast: "🎉 Төлбөр амжилттай төлөгдлөө!"
- [ ] Verify no more API calls in Network tab
- [ ] Payment section should change to green "Paid" card

### Test 3: Auto-refresh Doesn't Run for Paid Orders
- [ ] Open already-paid order page
- [ ] Open DevTools Network tab
- [ ] Wait 30 seconds
- [ ] Verify NO auto-refresh API calls
- [ ] Only initial page load request

### Test 4: Manual Refresh Still Works
- [ ] Open unpaid order page
- [ ] Click "Төлвийг шалгах" button
- [ ] See immediate API call (not waiting for 10s)
- [ ] See appropriate toast notification

---

## 📊 Expected Behavior Summary

| Scenario | Auto-Refresh? | Frequency | Notification? |
|----------|---------------|-----------|---------------|
| Unpaid order | ✅ Yes | Every 10s | Only when payment confirmed |
| Paid order | ❌ No | Never | No |
| User navigates away | ❌ Stops | Cleanup | No |
| Manual "Check Status" | N/A | Immediate | Yes (always) |
| Payment confirmed | ✅ One final check | Then stops | Yes |

---

## 🔧 Debugging Commands

### Check in Browser Console:

```javascript
// 1. Check current order status
console.log('Order:', order)
console.log('Payment Status:', order?.paymentStatus)

// 2. Check if useEffect is running
// (Add console.log in useEffect - see code below)

// 3. Count active intervals
// (Use Chrome DevTools Performance tab)

// 4. Manually trigger fetchOrder
// (Type in console)
fetchOrder(true)
```

---

## 📝 Code Review

**Current Auto-Refresh Code:**
```typescript
// File: apps/store/src/pages/OrderDetailPage.tsx
// Lines: ~32-42

useEffect(() => {
  if (!order || order.paymentStatus === 'PAID') return

  const interval = setInterval(() => {
    fetchOrder()  // Called every 10s
  }, 10000)

  return () => clearInterval(interval)  // Cleanup on unmount
}, [order?.id, order?.paymentStatus])
```

**How it Works:**
1. Runs when `order.id` or `order.paymentStatus` changes
2. If order is UNPAID, starts 10s interval
3. If order is PAID or not loaded, does nothing
4. Cleans up interval when component unmounts or dependencies change

**Dependencies Explained:**
- `order?.id` - Re-run if order ID changes (e.g., navigating to different order)
- `order?.paymentStatus` - Re-run if payment status changes (e.g., UNPAID → PAID)

When status changes to PAID:
1. Effect re-runs
2. Condition `order.paymentStatus === 'PAID'` is true
3. Returns early (doesn't create interval)
4. Previous interval is cleaned up
5. Auto-refresh stops ✅

---

## ✅ Verification Steps (Quick)

**1 Minute Test:**
```bash
1. Open unpaid order page
2. Open DevTools (F12) → Network tab
3. Filter: "orders"
4. Start timer
5. Count API calls in 60 seconds
6. Expected: 6 calls (0s, 10s, 20s, 30s, 40s, 50s)
```

**If you see 6 calls:** ✅ Auto-refresh working!
**If you see 1 call:** ❌ Auto-refresh not starting
**If you see >6 calls:** ⚠️ Multiple intervals running (bug)

---

## 🎯 Next Steps

If auto-refresh is NOT working:
1. Check browser console for errors
2. Verify `order.paymentStatus === 'UNPAID'`
3. Add console.log to useEffect (see enhanced code below)
4. Share console output for debugging
