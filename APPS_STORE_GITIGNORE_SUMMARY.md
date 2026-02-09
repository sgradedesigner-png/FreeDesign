# Apps/Store .gitignore Cleanup Summary

## Changes Made

### Updated Files
- ✅ `apps/store/.gitignore` - Enhanced from 85 to 144 lines
- ✅ `apps/store/.env.example` - Added template file

### Now Ignored (Previously Staged)
- ✅ `test-output-fixed.txt` - Test artifact (4KB)

### Large Files Still in Git (Legacy)
- ⚠️ `Size Guide.gif` (254KB) - Should consider Git LFS or external hosting
- ⚠️ `sizeguide.gif` (34KB) - Duplicate file
- ⚠️ `public/sizeguide.gif` (34KB) - Duplicate file

## New Protection Patterns

### Test Artifacts
```
test-output*.txt
test-output*.log
*test-results*.txt
*.test-output.*
```

### Playwright
```
test-results/
playwright-report/
playwright/.cache/
playwright/.auth/        # NEW: Auth state
```

### Coverage (Future-proof)
```
coverage/
.nyc_output/
*.lcov
```

### Build & Temp
```
*.tsbuildinfo           # NEW: TypeScript build info
*.tmp, *.temp           # NEW: Temp files
temp/                   # NEW: Temp directory
```

### Security
```
*.pem, *.key, *.cert, *.crt
credentials.json
service-account.json
```

### OS Files
```
NUL, _NUL              # NEW: Windows null files
desktop.ini            # NEW: Windows desktop config
```

### VSCode (Selective)
```
.vscode/*              # Ignore all
!.vscode/extensions.json   # Except extensions
!.vscode/settings.json     # Except settings
```

## Optional Patterns (Currently Commented)

### Media Files (Lines 110-115)
```bash
# Uncomment to ignore large media files:
# *.gif
# *.mp4
# *.webm
# Size Guide.gif
# sizeguide.gif
```

### Documentation (Lines 121-124)
```bash
# Uncomment to ignore temp docs:
# findsize.md
# repair.md
# ScaleFindSize.md
# ThingsToMade.md
```

## Recommended Actions

### Option 1: Remove Large GIF Files (Recommended)
```bash
# Remove from Git tracking (files stay on disk)
git rm --cached "apps/store/Size Guide.gif"
git rm --cached apps/store/sizeguide.gif
git rm --cached apps/store/public/sizeguide.gif

# Uncomment in .gitignore (lines 110, 114-115):
# *.gif
# Size Guide.gif
# sizeguide.gif

# Commit
git commit -m "chore: Remove large GIF files from git tracking (288KB total)"
```

### Option 2: Keep GIF Files with Git LFS
```bash
# Install Git LFS
git lfs install

# Track GIF files
git lfs track "*.gif"

# Add .gitattributes
git add .gitattributes

# Migrate existing files
git lfs migrate import --include="*.gif"

# Commit
git commit -m "chore: Migrate GIF files to Git LFS"
```

### Option 3: Move to External Hosting
```bash
# Upload to Cloudflare R2
# Update references in code to use R2 URLs
# Remove from git
git rm "apps/store/Size Guide.gif"
git rm apps/store/sizeguide.gif
```

## Commit Message (After GIF Cleanup)

```bash
git commit -m "chore: Enhance apps/store .gitignore patterns

Changes:
- ✅ Add test output patterns (test-output*.txt)
- ✅ Add Playwright auth cache (.auth/)
- ✅ Add coverage patterns (future-proof)
- ✅ Add build artifacts (*.tsbuildinfo)
- ✅ Add temp file patterns (*.tmp, *.temp)
- ✅ Add security patterns (*.pem, *.key)
- ✅ Add .env.example template
- ✅ Selective .vscode settings
- ❌ Remove test-output-fixed.txt from tracking
- ❌ Remove GIF files from tracking (288KB total)

Protected: Test outputs, auth state, media files, credentials
File count: 85 → 144 lines

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

## Verification

```bash
# Check .gitignore is working
git check-ignore apps/store/test-output-fixed.txt
# Output: apps/store/test-output-fixed.txt

# Check git status
git status apps/store/
# Should NOT show:
#   - test-output-fixed.txt
#   - playwright-report/
#   - test-results/

# Check file sizes
git ls-files -s apps/store/*.gif
# Should show file sizes (or empty if removed)
```

## Summary

- ✅ .gitignore enhanced with 59 new lines
- ✅ Test artifacts now ignored
- ✅ Security patterns added
- ✅ .env.example added for reference
- ⚠️ Large GIF files (288KB) require decision: Remove, LFS, or External
