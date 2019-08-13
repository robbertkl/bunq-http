export default function deepMerge(...args) {
  const result = {};
  args.forEach(arg =>
    Object.entries(arg).forEach(([key, value]) => {
      if (typeof result[key] === 'object' && typeof value === 'object') {
        result[key] = deepMerge(result[key], value);
      } else if (typeof value === 'object') {
        result[key] = deepMerge({}, value);
      } else {
        result[key] = value;
      }
    })
  );
  return result;
}
