import type { Request, Response, NextFunction } from "express";
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const { method, url } = req;
  res.on("finish", () => {
    const ms = Date.now() - start;
    const lvl =
      res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    const line = `[${new Date().toISOString()}] [${lvl}] [http] ${method} ${url} -> ${res.statusCode} ${ms}ms`;
    if (lvl === "error") console.error(line);
    else if (lvl === "warn") console.warn(line);
    else console.log(line);
  });
  next();
}
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  // 尊重 body-parser / http-errors 携带的状态码（如 400 解析失败、413 体积超限），
  // 非法值一律按 500 处理，避免把客户端错误误报为服务端错误
  let status = Number(err?.status || err?.statusCode) || 500;
  if (status < 400 || status > 599) status = 500;
  const code =
    status === 400
      ? "E_BAD_REQUEST"
      : status === 413
        ? "E_PAYLOAD_TOO_LARGE"
        : status === 401
          ? "E_AUTH"
          : status === 404
            ? "E_NOT_FOUND"
            : status >= 500
              ? "E_SERVER"
              : "E_CLIENT";
  const line = `[${new Date().toISOString()}] [${status >= 500 ? "error" : "warn"}] [http] unhandled ${status} ${err?.name || ""}: ${err?.message || ""}`;
  if (status >= 500) console.error(line, err);
  else console.warn(line);
  res
    .status(status)
    .json({ error: err?.message || "Internal Server Error", code });
}
