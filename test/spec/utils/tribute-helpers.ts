import Tribute from '../../../src/Tribute';
import type { TributeArgument, TributeCollection, TributeTemplate } from '../../../src/type';

type PartialCollection<T extends {}> = Partial<TributeCollection<T> & TributeTemplate<T> & TributeArgument<T>>;
export const attachTribute = <T extends {}>(collectionObject: PartialCollection<T>, inputElementId: string) => {
  const tribute = new Tribute(collectionObject);
  const element = document.getElementById(inputElementId);

  if (element === null) throw new Error();

  tribute.attach(element);
  return tribute;
};

export const detachTribute = <T extends {}>(tribute: Tribute<T>, inputElementId: string) => {
  const element = document.getElementById(inputElementId);
  if (element !== null) {
    tribute.detach(element);
  }
};

export function isContentEditable(element: HTMLElement) {
  return element.nodeName !== 'INPUT' && element.nodeName !== 'TEXTAREA';
}
