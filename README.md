# BacZone 🎓

منصة مجانية تجمع دروس وسلاسل تمارين وتصحيحات لجميع مواد الباكالوريا التقنية في تونس.

## النشر على GitHub Pages

1. أنشئ repo جديد على GitHub باسم `BacZone`
2. ارفع كل محتوى هذا المجلد إلى الـ repo:
   ```bash
   git init
   git add .
   git commit -m "BacZone v1"
   git branch -M main
   git remote add origin https://github.com/RayenJridi/BacZone.git
   git push -u origin main
   ```
3. روح لـ **Settings → Pages** في الـ repo، اختار **Branch: main**، فولدر **/(root)**
4. بعد دقيقة-دقيقتين، الموقع يولي متاح على:
   `https://RayenJridi.github.io/BacZone/`

## هيكلة الملفات

- `index.html` — صفحة المقدمة (عربي)
- `matieres.html` — قائمة المواد (8 مواد)
- `contact.html` — تواصل معنا
- `pages/` — صفحة لكل مادة (Cours / Séries / Correction + بحث)
- `style.css` — التصميم الموحّد لكل الموقع
- `robots.txt` + `sitemap.xml` — لتحسين الظهور في محركات البحث (SEO)

## تزيد ملف جديد؟

افتح صفحة المادة في `pages/`، ولقا القسم المناسب (Cours / Séries / Correction)، وزيد `<li>` جديدة على شكل:

```html
<li class="res-item"><span class="label">اسم الدرس</span><a class="go" href="رابط_Drive" target="_blank" rel="noopener">PDF →</a></li>
```
