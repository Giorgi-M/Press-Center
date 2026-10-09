# პრეს ცენტრის მართვის ცენტრი

გადაღებების დაგეგმვა და პრეს ცენტრის გუნდის (ოპერატორები, ფოტოგრაფები, პრესოფიცრები, მძღოლები, დრონის ოპერატორები...) კოორდინაცია.

## რას აკეთებს

- **შესვლა** Google-ით ან მომხმარებლის სახელით/პაროლით. შესვლა შეუძლია მხოლოდ იმას, ვინც ადმინმა დაამატა.
- **გადაღება**: სათაური, დრო, ხანგრძლივობა, გზაში დრო (ხელით ან Google Maps-ით), ადგილი, რუკის ბმული, ლოკაციის ფოტო, საკონტაქტო პირი (PR).
- **გუნდის დანიშვნა** პოზიციების მიხედვით. თუ ადამიანი ამ დროს (გზის ჩათვლით) სხვა გადაღებაზეა, სისტემა აჩვენებს გაფრთხილებას, მაგრამ დანიშვნას მაინც უშვებს.
- **კვირის განრიგი**, ფილტრით „ყველა / ჩემი“, მობილურზე მორგებული.
- **როლები და უფლებები** ადმინიდან: ახალი როლის დამატება და თითოეულისთვის უფლებების მონიშვნა.
- **შეტყობინებები** დანიშვნისას, ცვლილებისას, გაუქმებისას: ელფოსტა, SMS, WhatsApp, Telegram. თითოეული ირთვება მხოლოდ მაშინ, როცა მისი პარამეტრები შევსებულია.
- **Google Calendar**: თითოეულ თანამშრომელს აქვს პირადი კალენდრის ბმული (პროფილის გვერდზე).

## უფლებები

| უფლება | ნიშნავს |
|---|---|
| `events.create` | გადაღების შექმნა (და საკუთარის რედაქტირება) |
| `events.edit_all` | ნებისმიერი გადაღების რედაქტირება, გაუქმება, წაშლა |
| `events.view_all` | ყველა გადაღების ნახვა (სხვა შემთხვევაში მხოლოდ საკუთარი) |
| `events.assign` | თანამშრომლების დანიშვნა |
| `users.manage` | მომხმარებლების მართვა |
| `roles.manage` | როლების და უფლებების მართვა |

საწყისი როლები: ადმინისტრატორი, სააგენტოს უფროსი, პრესის უფროსი, პრესოფიცერი, ოპერატორი, ფოტოგრაფი, მემონტაჟე, მძღოლი, დრონის ოპერატორი, პროტოკოლი.

## ტექნოლოგია

Next.js 15 (App Router, server actions) + Supabase (Postgres, Auth, Storage) + Tailwind. ყველა მონაცემზე მოქმედებს Postgres RLS.

## ლოკალური გაშვება

```bash
npm install
npx supabase start            # Docker სჭირდება
cp .env.example .env.local    # ჩასვით გასაღებები `npx supabase status`-დან
set -a; source .env.local; set +a
node scripts/create-admin.mjs you@example.ge "სახელი გვარი" admin 'პაროლი123'
npm run dev
```

## Hetzner-ზე გაშვება

ერთი სერვერი (CX22 / CX32 საკმარისია), Ubuntu, Docker-ით.

1. **Supabase (self-hosted)** — ოფიციალური ინსტრუქცია: https://supabase.com/docs/guides/self-hosting/docker

   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   mkdir supabase-stack && cp -r supabase/docker/* supabase-stack/ && cp supabase/docker/.env.example supabase-stack/.env
   cd supabase-stack
   # .env-ში შეცვალეთ: POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, DASHBOARD_PASSWORD,
   # SITE_URL=https://press.example.ge, API_EXTERNAL_URL=https://api.press.example.ge,
   # ADDITIONAL_REDIRECT_URLS=https://press.example.ge/auth/callback, ENABLE_EMAIL_SIGNUP=false
   docker compose up -d
   ```

   **Google შესვლა**: Google Cloud Console → APIs & Services → Credentials → OAuth client (Web).
   Authorized redirect URI: `https://api.press.example.ge/auth/v1/callback`.
   შემდეგ `docker-compose.yml`-ში `auth` სერვისის `environment`-ს დაამატეთ:

   ```yaml
   GOTRUE_EXTERNAL_GOOGLE_ENABLED: "true"
   GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
   GOTRUE_EXTERNAL_GOOGLE_SECRET: ${GOOGLE_CLIENT_SECRET}
   GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI: https://api.press.example.ge/auth/v1/callback
   ```

   და `.env`-ში `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. სხვა Google ანგარიშები, რომლებიც ადმინს არ დაუმატებია, შესვლისას ავტომატურად იბლოკება.

2. **ბაზის სქემა**

   ```bash
   docker exec -i supabase-db psql -U postgres < press-center/supabase/migrations/20261009000000_init.sql
   ```

3. **აპლიკაცია**

   ```bash
   git clone <this repo> press-center && cd press-center/deploy
   cp .env.example .env   # შეავსეთ
   docker compose up -d --build
   ```

   DNS: `press.example.ge` და `api.press.example.ge` → სერვერის IP. HTTPS-ს Caddy თავად აწყობს.

4. **პირველი ადმინი**

   ```bash
   docker compose exec app node scripts/create-admin.mjs you@example.ge "სახელი გვარი" admin 'პაროლი123'
   ```

   დანარჩენ თანამშრომლებს ადმინი ამატებს საიტიდან („მომხმარებლები“).

## შეტყობინებების ჩართვა

ყველა არხი არასავალდებულოა. ცარიელი პარამეტრი = არხი გამორთულია. პარამეტრები: `deploy/.env.example`.

- **ელფოსტა**: ნებისმიერი SMTP (`SMTP_*`).
- **SMS**: `SMS_PROVIDER=smsoffice` (smsoffice.ge, `SMSOFFICE_API_KEY`, `SMS_SENDER`) ან `twilio`. სხვა პროვაიდერის დასამატებლად: `src/lib/notify/channels.ts` → `sendSms`. ქართული ტექსტი SMS-ში უნიკოდია, ამიტომ ერთი შეტყობინება რამდენიმე SMS-ად ითვლება.
- **WhatsApp** (Meta WhatsApp Cloud API): საჭიროა Meta Business ანგარიში, დადასტურებული ნომერი და დამტკიცებული შაბლონი. ბოტი მხოლოდ აგზავნის, პასუხს არ ელოდება. შაბლონი (`WHATSAPP_TEMPLATE`, კატეგორია Utility, ენა ka), 4 პარამეტრით:

  ```
  📸 გადაღება: {{1}}
  🕒 {{2}}
  📍 {{3}}
  👤 პოზიცია: {{4}}
  ```

- **Telegram**: შექმენით ბოტი @BotFather-ით, შეავსეთ `TELEGRAM_*`, შემდეგ დააყენეთ webhook:

  ```bash
  curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook?url=https://press.example.ge/api/telegram/webhook&secret_token=$TELEGRAM_WEBHOOK_SECRET"
  ```

  თანამშრომელი პროფილის გვერდზე აჭერს „Telegram-თან დაკავშირება“-ს.

- **Google Maps (გზაში დრო)**: Google Cloud-ში ჩართეთ **Routes API**, შექმენით API key, შეავსეთ `GOOGLE_MAPS_API_KEY` და `PRESS_CENTER_ORIGIN` (პრეს ცენტრის მისამართი ან `lat,lng`). თვეში პირველი 10 000 მოთხოვნა უფასოა.

ვერ გაგზავნილ შეტყობინებებს `cron` სერვისი ყოველ წუთს თავიდან ცდის (მაქს. 5-ჯერ).
