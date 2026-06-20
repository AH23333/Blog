import type { APIRoute } from "astro";
import { xmlHeaders } from "../modules/seo/http";

export const GET: APIRoute = () => {
  return new Response(`User-agent: *\nAllow: /\n`, {
    headers: xmlHeaders("text/plain")
  });
};
