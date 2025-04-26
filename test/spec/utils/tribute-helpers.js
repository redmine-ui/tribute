import Tribute from '../../../src/index';

export const attachTribute = (collectionObject, inputElementId) => {
  const tribute = new Tribute(collectionObject);
  tribute.attach(document.getElementById(inputElementId));
  return tribute;
};

export const detachTribute = (tribute, inputElementId) => {
  tribute.detach(document.getElementById(inputElementId));
};

export function isContentEditable(element) {
  return element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA';
}
