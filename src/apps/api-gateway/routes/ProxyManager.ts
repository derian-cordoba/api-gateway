import type { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { Gateway } from "../types/gateway";

export class ProxyManager {
  private readonly router: Router;

  constructor(router: Router) {
    this.router = router;
  }

  /**
   * Register all proxy routes in the application
   */
  registerProxyRoutes(): void {
    // TODO: Add validations and move this to a separate file
    const routes: [Gateway] = JSON.parse(process.env.ROUTES || "");

    routes.forEach((route: Gateway) =>
      this.router.use(route.baseURL, createProxyMiddleware(route.proxy))
    );
  }
}
