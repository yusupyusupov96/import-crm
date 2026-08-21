# ИМПОРТ·CRM

CRM для байеров, возящих товар из Китая. React + Vite + Supabase.

## 1. Локальный запуск (проверить перед деплоем)

```bash
npm install
cp .env.example .env
npm run dev
```

Открой http://localhost:5173 — должен появиться экран входа/регистрации.

Если при регистрации Supabase требует подтверждение email, а ты хочешь проверить быстрее:
зайди в Supabase → Authentication → Providers → Email → выключи "Confirm email" (перед реальным запуском для клиентов лучше включить обратно).

## 2. Залить на GitHub

```bash
git init
git add .
git commit -m "Первая версия ИМПОРТ·CRM"
```

Создай новый репозиторий на github.com (просто "New repository", без README — он уже есть),
затем:

```bash
git remote add origin https://github.com/ТВОЙ_НИК/import-crm.git
git branch -M main
git push -u origin main
```

Файл `.env` в репозиторий не попадёт — он в `.gitignore`, это правильно (там ключи).

## 3. Задеплоить на Vercel

1. Зайди на vercel.com, войди через GitHub
2. "Add New" → "Project" → выбери репозиторий `import-crm`
3. Vercel сам определит, что это Vite-проект
4. **Важно**: перед деплоем добавь Environment Variables (в настройках проекта):
   - `VITE_SUPABASE_URL` = `https://dsjbrxvtvorzmzwtzobd.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_S6Q3uY8w045PnXRhWSPiLg_IIQgFnkU`
5. Нажми "Deploy"

Через минуту получишь настоящую ссылку вида `import-crm.vercel.app` — рабочий сайт с реальной регистрацией и базой данных.

## Структура проекта

- `src/App.jsx` — вся CRM (дашборд, клиенты, заказы, калькулятор, накладные)
- `src/supabaseClient.js` — подключение к Supabase
- Калькулятор и Накладные пока не сохраняются в базу (работают локально в браузере) — следующий шаг доработки

## Что дальше

- Подключить оплату подписки через ЮKassa
- Сохранять накладные и расчёты калькулятора в Supabase
- Настроить своё название домена вместо *.vercel.app
