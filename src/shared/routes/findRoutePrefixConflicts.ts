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
      const exact = firstPrefix === secondPrefix;
      const nested =
        firstPrefix.startsWith(`${secondPrefix}/`) ||
        secondPrefix.startsWith(`${firstPrefix}/`);

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
