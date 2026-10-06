// Ignore items where key is null, undefined, or empty string.
// Preserve original item order inside each group.
// Return plain object (not Map).
// Must be O(n) time.

export type Grouped<T> = Record<string, T[]>;

export function groupByStable<T>(
  items: T[],
  getKey: (item: T) => string | null | undefined
): Grouped<T>{
    const result: Grouped<T> = {};
    for (const item of items){
        const key = getKey(item);
        if( key === null || key === undefined || key === ""){
            continue;
        }
        if( !result[key]){
            result[key] = [];
        }
        result[key].push(item);
    }
    return result;
}

