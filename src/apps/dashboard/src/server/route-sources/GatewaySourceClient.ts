import { HttpManager, HttpError } from "@shared/services/networking";
import { withErrorContext } from "@shared/errors/withErrorContext";
import type { SourceRuntimeStatus } from "../../../../../modules/route-sources/types";
import {
  ConfigurationConflictError,
  RouteStorageError,
} from "../../../../../modules/route-configuration/domain/errors";
import { StatusCodes } from "http-status-codes";

export class GatewaySourceClient {
  private client(): HttpManager {
    const url = process.env.GATEWAY_MANAGEMENT_URL;
    const token = process.env.GATEWAY_MANAGEMENT_TOKEN;
    if (!url || !token)
      throw new RouteStorageError(
        "Configure Dashboard's gateway management URL and token to inspect or activate the live source.",
        "configuration",
      );
    return new HttpManager({
      baseURL: url,
      headers: { Authorization: `Bearer ${token}` },
      timeoutMs: 15000,
    });
  }

  status(): Promise<SourceRuntimeStatus> {
    return this.call(() => this.client().get("/v1/route-sources"));
  }

  activate(
    id: string,
    expectedVersion: number,
    expectedRevision: string,
  ): Promise<SourceRuntimeStatus> {
    return this.call(() =>
      this.client().post(`/v1/route-sources/${encodeURIComponent(id)}/activate`, {
        json: { expectedVersion, expectedRevision },
      }),
    );
  }

  private call<T>(work: () => Promise<T>): Promise<T> {
    return withErrorContext(work, {
      createException: (cause) => {
        if (cause instanceof RouteStorageError) {
          return cause;
        }

        if (cause instanceof HttpError && cause.status === StatusCodes.CONFLICT) {
          return new ConfigurationConflictError("requested selection", "changed selection");
        }

        return new RouteStorageError(
          "Gateway source management is unavailable. Verify its management connection, profiles, and control database.",
          "unavailable",
          { cause },
        );
      },
    });
  }
}
