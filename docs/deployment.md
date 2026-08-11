# Deployment
Deploy the API as Vercel-compatible Node handlers after routes are implemented. Run polling and delivery as an independent worker service with PostgreSQL access; Vercel Hobby cron is not sufficient. Set `DATABASE_URL` and `RAILRADAR_API_KEY` in server/worker environment only.
