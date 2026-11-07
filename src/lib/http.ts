export class AppError extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export function errorResponse(err: unknown): Response {
  const status =
    err instanceof AppError
      ? err.status
      : typeof (err as { status?: unknown })?.status === "number"
        ? (err as { status: number }).status
        : 500;
  const message = err instanceof Error ? err.message : "Erro inesperado";
  return Response.json({ error: message }, { status });
}
