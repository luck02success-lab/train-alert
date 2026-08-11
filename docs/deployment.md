# Deployment
Deploy Vercel-compatible Node handlers. `RAILRADAR_API_KEY` and `DATABASE_URL` are required server/worker environment variables. RailRadar uses `Authorization: Bearer`; never add it to Vercel client variables. Run polling and delivery as an independent worker service; Vercel Hobby cron is not sufficient.
