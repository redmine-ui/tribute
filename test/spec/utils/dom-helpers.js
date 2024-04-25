import { sendKeys } from '@web/test-runner-commands';

export const createDomElement = function(element = 'text') {
  let elementToCreate = 'input';
  if (element === 'contenteditable') {
    elementToCreate = 'div';
  }
  let wrapperDiv = document.createElement('div');
  wrapperDiv.id = 'tribute-wrapper-div';
  let input = document.createElement(elementToCreate);
  input.id = `tribute-${element}`;
  wrapperDiv.appendChild(input);
  document.body.appendChild(wrapperDiv);
  return input;
}

export const clearDom = function() {
  let wrapperDiv = document.querySelector('#tribute-wrapper-div');
  if (wrapperDiv) {
    wrapperDiv.parentNode.removeChild(wrapperDiv);
  }
  let tributeContainer = document.querySelector('.tribute-container');
  if (tributeContainer) {
    tributeContainer.parentNode.removeChild(tributeContainer);
  }
}

export async function fillIn(input, text) {
  input.focus();
  await sendKeys({
    type: text
  });
}

export async function press(key) {
  await sendKeys({
    press: key
  });
}

export const simulateMouseClick = function(targetNode) {
  function triggerMouseEvent(targetNode, eventType) {
    let clickEvent = document.createEvent('MouseEvents');
    clickEvent.initEvent(eventType, true, true);
    targetNode.dispatchEvent(clickEvent);
  }
  ["mouseover", "mousedown", "mouseup", "click"].forEach(function (eventType) {
    triggerMouseEvent(targetNode, eventType);
  });
}

export const simulateElementScroll = function(container) {
  container.dispatchEvent(new Event('scroll'));
}
