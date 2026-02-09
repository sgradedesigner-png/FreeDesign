#!/bin/bash
# Git commit script for .gitignore cleanup

echo "🔒 Committing security improvements..."

git commit -m "security: Update backend .gitignore to protect sensitive files

Changes:
- ✅ Add comprehensive .gitignore (127 lines)
- ✅ Add .env.example template for developers
- ❌ Remove .env.test from tracking (test DB credentials)
- ❌ Remove coverage/ from tracking (38 test files)

Protected files:
- Environment variables (.env*)
- Test coverage (coverage/)
- Build outputs (dist/)
- Logs (*.log, qpay_test.log)
- IDE settings (.claude/, .vscode/)
- Database credentials
- API keys and secrets

Note: .env.test and coverage/ files still exist locally but are
no longer tracked by Git.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

echo ""
echo "✅ Commit created!"
echo ""
echo "📤 Next steps:"
echo "1. Review the commit: git show HEAD"
echo "2. Push to remote: git push origin pre-production"
echo ""
echo "⚠️  IMPORTANT: If .env.test was in previous commits,"
echo "   those old commits still contain the credentials!"
echo "   Consider rotating your test database password."
