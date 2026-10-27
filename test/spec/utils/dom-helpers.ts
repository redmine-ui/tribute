import { sendKeys } from '@web/test-runner-commands';

export const createDomElement = (element: string = 'text') => {
  let elementToCreate = 'input';
  if (element === 'contenteditable') {
    elementToCreate = 'div';
  }
  const wrapperDiv = document.createElement('div');
  wrapperDiv.id = 'tribute-wrapper-div';
  const input = document.createElement(elementToCreate);
  input.id = `tribute-${element}`;
  wrapperDiv.appendChild(input);
  document.body.appendChild(wrapperDiv);
  return input;
};

export const clearDom = () => {
  const wrapperDiv = document.querySelector('#tribute-wrapper-div');
  if (wrapperDiv) {
    wrapperDiv?.parentNode?.removeChild(wrapperDiv);
  }
  const tributeContainer = document.querySelector('.tribute-container');
  if (tributeContainer) {
    tributeContainer.parentNode?.removeChild(tributeContainer);
  }
};

export async function fillIn(input: HTMLElement, text: string) {
  input.focus();
  await sendKeys({
    type: text,
  });
}

export async function press(key: string) {
  await sendKeys({
    press: key,
  });
}

export const simulateMouseClick = (targetNode: Element | undefined) => {
  if (!targetNode) return;

  function triggerMouseEvent(targetNode: Element, eventType: string) {
    const clickEvent = document.createEvent('MouseEvents');
    clickEvent.initEvent(eventType, true, true);
    targetNode.dispatchEvent(clickEvent);
  }
  for (const eventType of ['mouseover', 'mousedown', 'mouseup', 'click']) {
    triggerMouseEvent(targetNode, eventType);
  }
};

export const simulateElementScroll = (container: HTMLElement | (Window & typeof globalThis)) => {
  container.dispatchEvent(new Event('scroll'));
};
