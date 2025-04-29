export function addHandler(element, ...args) {
  element.addEventListener(...args);
  return () => element.removeEventListener(...args);
}

export function isContentEditable(element) {
  return element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA';
}
