import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Allowed browser origins for cross-origin requests. Comma-separated env var;
// defaults to the local Vite dev origin so local development keeps working.
// In production set CORS_ALLOWED_ORIGINS to the deployed frontend origin(s).
// (On Replit the frontend and API are same-origin behind the router, and in
// local dev the Vite proxy makes API calls same-origin, so this is primarily
// defense-in-depth against unexpected cross-origin browser callers.)
const allowedOrigins = (
  process.env["CORS_ALLOWED_ORIGINS"] ?? "http://localhost:24510"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser / same-origin requests (no Origin header) and any
      // explicitly configured frontend origin. Other origins receive no CORS
      // headers, so browsers block the cross-origin response.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
