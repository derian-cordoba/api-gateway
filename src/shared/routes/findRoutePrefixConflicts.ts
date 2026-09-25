export type RoutePrefixConflict = {
  firstIndex: number;
  secondIndex: number;
  firstPrefix: string;
  secondPrefix: string;
  exact: boolean;
};

export function findRoutePrefixConflicts(
  routes: readonly { baseURL: string }[],
): RoutePrefixConflict[] {
  const conflicts: RoutePrefixConflict[] = [];

  for (let firstIndex = 0; firstIndex < routes.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < routes.length;
      secondIndex += 1
    ) {
      const firstPrefix = routes[firstIndex].baseURL;
      const secondPrefix = routes[secondIndex].baseURL;
      const firstMatchPath = normalizeMatchPath(firstPrefix);
      const secondMatchPath = normalizeMatchPath(secondPrefix);
      const exact = firstMatchPath === secondMatchPath;
      const nested =
        isNested(firstMatchPath, secondMatchPath) ||
        isNested(secondMatchPath, firstMatchPath);

      if (exact || nested) {
        conflicts.push({
          firstIndex,
          secondIndex,
          firstPrefix,
          secondPrefix,
          exact,
        });
      }
    }
  }

  return conflicts;
}

function normalizeMatchPath(path: string): string {
  // Express routers are case-insensitive and ignore trailing slashes by default.
  return path.replace(/\/+$/, "").toLowerCase() || "/";
}

function isNested(parent: string, child: string): boolean {
  return parent === "/" ? child !== "/" : child.startsWith(`${parent}/`);
}
