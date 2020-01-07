export class Utils {
  static toDictionary<T>(items: T[], getKey: (t: T) => string): {[key: string]: T} {
    const dictionary: {[key: string]: T} = {};
    for (const item of items) {
      dictionary[getKey(item)] = item;
    }
    return dictionary;
  }
}
