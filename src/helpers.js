export function addHandler(element, ...args) {
  element.addEventListener(...args);
  return () => element.removeEventListener(...args);
}
