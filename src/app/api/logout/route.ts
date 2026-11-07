import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/login", req.url).toString(),
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}
