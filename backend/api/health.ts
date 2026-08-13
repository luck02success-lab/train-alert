export async function GET(): Promise<Response> {
  return Response.json({
    status: "ok",
    service: "train-alert-api",
    timestamp: new Date().toISOString(),
  });
}
