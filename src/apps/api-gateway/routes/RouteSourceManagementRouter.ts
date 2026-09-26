import { Router } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../../../modules/route-configuration/domain/errors";
import type { ManagedRouteReloader } from "./ManagedRouteReloader";

export function createRouteSourceManagementRouter(
  runtime: ManagedRouteReloader,
): Router {
  const router = Router();

  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (_request, response) => {
    try {
      response.json(await runtime.status());
    } catch {
      response
        .status(StatusCodes.SERVICE_UNAVAILABLE)
        .json({ message: "Route source status is unavailable." });
    }
  });

  router.post("/:id/activate", async (request, response) => {
    const body = z
      .object({
        expectedVersion: z
          .number()
          .int()
          .nonnegative()
          .max(Number.MAX_SAFE_INTEGER - 1),
        expectedRevision: z.string().regex(/^(?:[a-f0-9]{16}|[a-f0-9]{32})$/),
      })
      .strict()
      .safeParse(request.body);

    if (!body.success) {
      response
        .status(StatusCodes.BAD_REQUEST)
        .json({
          message:
            "Expected activation version and source revision are required.",
        });
      return;
    }

    try {
      response.json(
        await runtime.activate(
          request.params.id,
          body.data.expectedVersion,
          body.data.expectedRevision,
        ),
      );
    } catch (cause) {
      const status =
        cause instanceof ConfigurationConflictError
          ? StatusCodes.CONFLICT
          : cause instanceof RouteStorageError && cause.code === "not-found"
            ? StatusCodes.NOT_FOUND
            : cause instanceof RouteStorageError &&
              cause.code === "configuration"
              ? StatusCodes.BAD_REQUEST
              : StatusCodes.SERVICE_UNAVAILABLE;
      response
        .status(status)
        .json({
          message:
            cause instanceof ConfigurationConflictError
              ? "The source or activation changed. Refresh before activating."
              : "Could not activate this route source. Verify its configuration and control database.",
        });
    }
  });

  return router;
}
