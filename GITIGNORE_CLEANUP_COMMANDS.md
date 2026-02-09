# Git Cleanup Commands - Нууцлалтай файлууд устгах

## ⚠️ Асуудал
Git дотор дараах нууцлалтай файлууд байна:
- `backend/.env.test` - Test database credentials
- `backend/coverage/` - Test coverage files (70+ files)

## ✅ Шийдэл (3 алхам)

### Алхам 1: Git tracking-ээс хас (файлууд устгахгүй!)

```bash
# Backend folder руу ор
cd backend

# .env.test файлыг Git-ээс хас (компьютерт үлдэнэ)
git rm --cached .env.test

# Coverage folder-ийг бүхэлд нь хас
git rm --cached -r coverage/

# Буцаж root folder руу ор
cd ..
```

### Алхам 2: .gitignore-ийг commit хий

```bash
# Шинэ .gitignore болон .env.example-ийг нэм
git add backend/.gitignore
git add backend/.env.example

# Commit хий
git commit -m "security: Update backend .gitignore to protect sensitive files

- Add comprehensive .gitignore rules
- Remove .env.test and coverage/ from tracking
- Add .env.example for reference
- Protect logs, credentials, and build outputs"
```

### Алхам 3: Баталгаажуулалт

```bash
# Git status-ийг шалга
git status

# .env.test болон coverage/ deleted харагдах ёстой
# Жишээ:
#   deleted:    backend/.env.test
#   deleted:    backend/coverage/base.css
#   deleted:    backend/coverage/...
```

## 📋 Дараа нь хийх зүйлс

### 1. Commit хийх өмнө баталгаажуулах:

```bash
# Эдгээр файлууд БАЙХ ёстой:
git status | grep "backend/.gitignore"      # Modified
git status | grep "backend/.env.example"     # Added

# Эдгээр файлууд БАЙХГҮЙ байх ёстой:
git status | grep "backend/.env.test"        # Deleted (OK!)
git status | grep "backend/coverage/"        # Deleted (OK!)
```

### 2. GitHub руу push хийх:

```bash
# pre-production branch руу push
git push origin pre-production

# Эсвэл master branch руу (production-ready бол)
git push origin master
```

## ⚠️ АНХААР: Хуучин commit-үүд

Хэрэв `.env.test` эсвэл `coverage/` файлууд **өмнө нь commit хийгдсэн** бол:
- Тэд **Git history дотор үлдэнэ**
- GitHub дээр хуучин commit-үүдээс харж болно
- Үүнийг шийдэхийн тулд **git history rewrite** хэрэгтэй (advanced)

### Git History-г цэвэрлэх (Advanced):

```bash
# ⚠️ АНХААР: Энэ нь git history-г өөрчилнө!
# Бусад хүмүүс pull хийсэн бол асуудал гарна

# 1. BFG Repo-Cleaner ашиглах (хамгийн хялбар):
# Download: https://rtyley.github.io/bfg-repo-cleaner/

# .env.test-ийг history-ээс устга
java -jar bfg.jar --delete-files .env.test

# Coverage folder-ийг history-ээс устга
java -jar bfg.jar --delete-folders coverage

# Git-ийг цэвэрлэ
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ Анхаар: collaborative work-т бүү хий!)
git push --force-with-lease
```

## 🎯 Хамгийн аюулгүй арга:

Хэрэв та production database credentials эсвэл API keys commit хийсэн бол:

1. **Шууд credentials-ийг солих** (Supabase/QPay dashboard дээр)
2. Git history cleanup нь хангалтгүй (GitHub дээр caching байж болно)
3. Credentials rotation = 100% safe

## 📚 .env.example ашиглах

```bash
# Шинэ developer-д зориулж:
cp backend/.env.example backend/.env

# Дараа нь backend/.env дотор бодит credentials оруулах
# .gitignore автоматаар .env-ийг ignore хийнэ
```

## ✅ Амжилттай болсон эсэхийг шалгах

```bash
# 1. Git status цэвэр байх ёстой
git status
# Output: "nothing to commit, working tree clean"

# 2. .env.test git дотор байхгүй
git ls-files | grep .env.test
# Output: (хоосон)

# 3. coverage git дотор байхгүй
git ls-files | grep coverage
# Output: (хоосон)

# 4. .gitignore ажиллаж байгаа эсэхийг шалгах
git check-ignore backend/.env.test
# Output: backend/.env.test  (ignored гэсэн үг)

git check-ignore backend/coverage/index.html
# Output: backend/coverage/index.html  (ignored гэсэн үг)
```

---

**Тайлбар:**
- `git rm --cached` = Git tracking-ээс хас, гэхдээ файлыг компьютерт үлдээ
- `git rm` (--cached-гүй) = Git-ээс болон компьютерээс устга (бүү хэрэглэ!)
