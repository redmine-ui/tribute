import { expect } from 'chai';

import Tribute from '../../src/index.js';
import bigList from './utils/bigList.json' with { type: 'json' };

import { clearDom, createDomElement, fillIn, press, simulateElementScroll, simulateMouseClick } from './utils/dom-helpers';

import { attachTribute, detachTribute } from './utils/tribute-helpers';

describe('Tribute instantiation', () => {
  it('should not error in the base case from the README', () => {
    const options = [
      { key: 'Phil Heartman', value: 'pheartman' },
      { key: 'Gordon Ramsey', value: 'gramsey' },
    ];
    const tribute = new Tribute({
      values: options,
    });

    expect(tribute.collection[0].values).to.equal(options);
  });
});

describe('Tribute @mentions cases', () => {
  afterEach(() => {
    clearDom();
  });

  // biome-ignore lint/complexity/noForEach: test code.
  ['text', 'contenteditable'].forEach((elementType) => {
    // biome-ignore lint/complexity/noForEach: test code.
    ['@', '$('].forEach((trigger) => {
      it(`when values key is predefined array. For : ${elementType} / ${trigger}`, async () => {
        const input = createDomElement(elementType);

        const collectionObject = {
          trigger: trigger,
          selectTemplate: function (item) {
            if (typeof item === 'undefined') return null;
            if (this.range.isContentEditable(this.current.element)) {
              return `<span contenteditable="false"><a href="http://zurb.com" target="_blank" title="${item.original.email}">${item.original.value}</a></span>`;
            }

            return trigger + item.original.value;
          },
          values: [
            {
              key: 'Jordan Humphreys',
              value: 'Jordan Humphreys',
              email: 'getstarted@zurb.com',
            },
            {
              key: 'Sir Walter Riley',
              value: 'Sir Walter Riley',
              email: 'getstarted+riley@zurb.com',
            },
          ],
        };

        const tribute = attachTribute(collectionObject, input.id);

        await fillIn(input, ` ${trigger}`);
        let popupList = document.querySelectorAll('.tribute-container > ul > li');
        expect(popupList.length).to.equal(2);
        simulateMouseClick(popupList[0]); // click on Jordan Humphreys

        if (elementType === 'text') {
          expect(input.value).to.equal(` ${trigger}Jordan Humphreys `);
        } else if (elementType === 'contenteditable') {
          expect(input.innerHTML).to.equal(
            '&nbsp;<span contenteditable="false"><a href="http://zurb.com" target="_blank" title="getstarted@zurb.com">Jordan Humphreys</a></span>&nbsp;',
          );
        }

        await fillIn(input, ` ${trigger}sir`);
        popupList = document.querySelectorAll('.tribute-container > ul > li');
        expect(popupList.length).to.equal(1);

        detachTribute(tribute, input.id);
      });

      it(`when values array is large and menuItemLimit is set. For : ${elementType} / ${trigger}`, async () => {
        const input = createDomElement(elementType);

        const collectionObject = {
          trigger: trigger,
          menuItemLimit: 25,
          selectTemplate: function (item) {
            if (typeof item === 'undefined') return null;
            if (this.range.isContentEditable(this.current.element)) {
              return `<span contenteditable="false"><a href="http://zurb.com" target="_blank" title="${item.original.email}">${item.original.value}</a></span>`;
            }

            return trigger + item.original.value;
          },
          values: bigList,
        };

        const tribute = attachTribute(collectionObject, input.id);

        await fillIn(input, ` ${trigger}`);
        let popupList = document.querySelectorAll('.tribute-container > ul > li');
        expect(popupList.length).to.equal(25);

        await fillIn(input, ` ${trigger}an`);
        popupList = document.querySelectorAll('.tribute-container > ul > li');
        expect(popupList.length).to.equal(25);

        detachTribute(tribute, input.id);
      });

      it('should add itemClass to list items when set it config', async () => {
        const input = createDomElement(elementType);

        const collectionObject = {
          trigger: trigger,
          itemClass: 'mention-list-item',
          selectClass: 'mention-selected',
          values: [
            {
              key: 'Jordan Humphreys',
              value: 'Jordan Humphreys',
              email: 'getstarted@zurb.com',
            },
            {
              key: 'Sir Walter Riley',
              value: 'Sir Walter Riley',
              email: 'getstarted+riley@zurb.com',
            },
          ],
        };

        const tribute = attachTribute(collectionObject, input.id);

        await fillIn(input, ` ${trigger}`);
        const popupList = document.querySelectorAll('.tribute-container > ul > li');
        expect(popupList.length).to.equal(2);

        expect(popupList[0].className).to.equal('mention-list-item mention-selected');
        expect(popupList[1].className).to.equal('mention-list-item');

        detachTribute(tribute, input.id);
      });
    });
  });
});

describe('Tribute autocomplete mode cases', () => {
  afterEach(() => {
    clearDom();
  });

  // biome-ignore lint/complexity/noForEach: test code.
  ['text', 'contenteditable'].forEach((elementType) => {
    it(`when values key with autocompleteSeparator option. For : ${elementType}`, async () => {
      const input = createDomElement(elementType);

      const collectionObject = {
        selectTemplate: (item) => item.original.value,
        autocompleteMode: true,
        autocompleteSeparator: new RegExp(/\-|\+/),
        values: [
          { key: 'Jordan Humphreys', value: 'Jordan Humphreys', email: 'getstarted@zurb.com' },
          { key: 'Sir Walter Riley', value: 'Sir Walter Riley', email: 'getstarted+riley@zurb.com' },
        ],
      };

      const tribute = attachTribute(collectionObject, input.id);

      await fillIn(input, '+J');
      let popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(1);
      simulateMouseClick(popupList[0]); // click on Jordan Humphreys

      if (elementType === 'text') {
        expect(input.value).to.equal('+Jordan Humphreys ');
      } else if (elementType === 'contenteditable') {
        expect(input.innerText).to.equal('+Jordan Humphreys ');
      }

      await fillIn(input, ' Si');
      popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(1);

      detachTribute(tribute, input.id);
    });
  });

  // biome-ignore lint/complexity/noForEach: test code.
  ['text', 'contenteditable'].forEach((elementType) => {
    it(`when values key is predefined array. For : ${elementType}`, async () => {
      const input = createDomElement(elementType);

      const collectionObject = {
        selectTemplate: (item) => item.original.value,
        autocompleteMode: true,
        values: [
          {
            key: 'Jordan Humphreys',
            value: 'Jordan Humphreys',
            email: 'getstarted@zurb.com',
          },
          {
            key: 'Sir Walter Riley',
            value: 'Sir Walter Riley',
            email: 'getstarted+riley@zurb.com',
          },
        ],
      };

      const tribute = attachTribute(collectionObject, input.id);

      await fillIn(input, ' J');
      let popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(1);
      simulateMouseClick(popupList[0]); // click on Jordan Humphreys

      if (elementType === 'text') {
        expect(input.value).to.equal(' Jordan Humphreys ');
      } else if (elementType === 'contenteditable') {
        // surrounded by nbsp, not spaces
        expect(input.innerText).to.equal(' Jordan Humphreys ');
      }

      await fillIn(input, ' Si');
      popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(1);

      detachTribute(tribute, input.id);
    });
  });

  // biome-ignore lint/complexity/noForEach: test code.
  ['text', 'contenteditable'].forEach((elementType) => {
    it(`when values key is a function. For : ${elementType}`, async () => {
      const input = createDomElement(elementType);

      const collectionObject = {
        autocompleteMode: true,
        selectClass: 'sample-highlight',

        noMatchTemplate: function () {
          this.hideMenu();
        },

        selectTemplate: function (item) {
          if (typeof item === 'undefined') return null;
          if (this.range.isContentEditable(this.current.element)) {
            return `&nbsp;<a contenteditable=false>${item.original.value}</a>`;
          }

          return item.original.value;
        },

        values: (text, cb) => {
          searchFn(text, (users) => cb(users));
        },
      };

      function searchFn(text, cb) {
        if (text === 'a') {
          cb([
            { key: 'Alabama', value: 'Alabama' },
            { key: 'Alaska', value: 'Alaska' },
            { key: 'Arizona', value: 'Arizona' },
            { key: 'Arkansas', value: 'Arkansas' },
          ]);
        } else if (text === 'c') {
          cb([
            { key: 'California', value: 'California' },
            { key: 'Colorado', value: 'Colorado' },
          ]);
        } else {
          cb([]);
        }
      }

      const tribute = attachTribute(collectionObject, input.id);

      await fillIn(input, ' a');
      let popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(4);
      simulateMouseClick(popupList[0]);

      if (elementType === 'text') {
        expect(input.value).to.equal(' Alabama ');
      } else if (elementType === 'contenteditable') {
        // The first letter is nbsp
        expect(input.innerText).to.equal('  Alabama ');
      }

      await fillIn(input, ' c');
      popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(2);
      simulateMouseClick(popupList[1]);

      if (elementType === 'text') {
        expect(input.value).to.equal(' Alabama  Colorado ');
      } else if (elementType === 'contenteditable') {
        // The first letter is nbsp
        expect(input.innerText).to.equal('  Alabama   Colorado ');
      }

      await fillIn(input, ' none');
      const popupListWrapper = document.querySelector('.tribute-container');
      expect(popupListWrapper.style.display).to.equal('none');

      detachTribute(tribute, input.id);
    });
  });

  // biome-ignore lint/complexity/noForEach: test code.
  ['contenteditable'].forEach((elementType) => {
    it('should work with newlines', async () => {
      const input = createDomElement(elementType);

      const collectionObject = {
        selectTemplate: (item) => item.original.value,
        autocompleteMode: true,
        values: [
          {
            key: 'Jordan Humphreys',
            value: 'Jordan Humphreys',
            email: 'getstarted@zurb.com',
          },
          {
            key: 'Sir Walter Riley',
            value: 'Sir Walter Riley',
            email: 'getstarted+riley@zurb.com',
          },
        ],
      };

      const tribute = attachTribute(collectionObject, input.id);
      await fillIn(input, 'random{newline}J');
      const popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(popupList.length).to.equal(1);
      detachTribute(tribute, input.id);
    });
  });
});

describe('When Tribute searchOpts.skip', () => {
  afterEach(() => {
    clearDom();
  });

  it('should skip local filtering and display all items', async () => {
    const input = createDomElement();

    const collectionObject = {
      searchOpts: { skip: true },
      noMatchTemplate: function () {
        this.hideMenu();
      },
      selectTemplate: (item) => item.original.value,
      values: [
        { key: 'Tributação e Divisas', value: 'Tributação e Divisas' },
        { key: 'Tributação e Impostos', value: 'Tributação e Impostos' },
        { key: 'Tributação e Taxas', value: 'Tributação e Taxas' },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@random-text');

    const popupList = document.querySelectorAll('.tribute-container > ul > li');
    expect(popupList.length).to.equal(3);

    detachTribute(tribute, input.id);
  });
});

describe('Tribute NoMatchTemplate cases', () => {
  afterEach(() => {
    clearDom();
  });

  it('should display template when specified as text', async () => {
    const input = createDomElement();

    const collectionObject = {
      noMatchTemplate: 'testcase',
      selectTemplate: (item) => item.original.value,
      values: [
        {
          key: 'Jordan Humphreys',
          value: 'Jordan Humphreys',
          email: 'getstarted@zurb.com',
        },
        {
          key: 'Sir Walter Riley',
          value: 'Sir Walter Riley',
          email: 'getstarted+riley@zurb.com',
        },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@random-text');

    const containerDiv = document.getElementsByClassName('tribute-container')[0];
    expect(containerDiv.innerText).to.equal('testcase');

    detachTribute(tribute, input.id);
  });

  it('should display template when specified as function', async () => {
    const input = createDomElement();

    const collectionObject = {
      noMatchTemplate: () => 'testcase',
      selectTemplate: (item) => item.original.value,
      values: [
        {
          key: 'Jordan Humphreys',
          value: 'Jordan Humphreys',
          email: 'getstarted@zurb.com',
        },
        {
          key: 'Sir Walter Riley',
          value: 'Sir Walter Riley',
          email: 'getstarted+riley@zurb.com',
        },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@random-text');

    const containerDiv = document.getElementsByClassName('tribute-container')[0];
    expect(containerDiv.innerText).to.equal('testcase');

    detachTribute(tribute, input.id);
  });

  it('should display no menu container when text is empty', async () => {
    const input = createDomElement();

    const collectionObject = {
      noMatchTemplate: '',
      selectTemplate: (item) => item.original.value,
      values: [
        {
          key: 'Jordan Humphreys',
          value: 'Jordan Humphreys',
          email: 'getstarted@zurb.com',
        },
        {
          key: 'Sir Walter Riley',
          value: 'Sir Walter Riley',
          email: 'getstarted+riley@zurb.com',
        },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@random-text');

    const popupListWrapper = document.querySelector('.tribute-container');
    expect(popupListWrapper.style.display).to.equal('none');

    detachTribute(tribute, input.id);
  });

  it('should display no menu when function returns empty string', async () => {
    const input = createDomElement();

    const collectionObject = {
      noMatchTemplate: () => '',
      selectTemplate: (item) => item.original.value,
      values: [
        {
          key: 'Jordan Humphreys',
          value: 'Jordan Humphreys',
          email: 'getstarted@zurb.com',
        },
        {
          key: 'Sir Walter Riley',
          value: 'Sir Walter Riley',
          email: 'getstarted+riley@zurb.com',
        },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@random-text');

    const popupListWrapper = document.querySelector('.tribute-container');
    expect(popupListWrapper.style.display).to.equal('none');

    detachTribute(tribute, input.id);
  });

  it('should display indivisual messages when a template set in each collection', async () => {
    const input = createDomElement();

    const collectionObject = {
      collection: [
        {
          trigger: '@',
          noMatchTemplate: 'template 1',
          values: [
            {
              key: 'Jordan Humphreys',
              value: 'Jordan Humphreys',
              email: 'getstarted@zurb.com',
            },
          ],
        },
        {
          trigger: '#',
          noMatchTemplate: 'template 2',
          values: [
            {
              key: 'Sir Walter Riley',
              value: 'Sir Walter Riley',
              email: 'getstarted+riley@zurb.com',
            },
          ],
        },
      ],
      selectTemplate: (item) => item.original.value,
    };
    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@random-text');

    const containerDiv = document.getElementsByClassName('tribute-container')[0];
    expect(containerDiv.innerText).to.equal('template 1');

    detachTribute(tribute, input.id);
  });
});

describe('Tribute menu positioning', () => {
  afterEach(() => {
    clearDom();
  });

  async function checkPosition(collectionObject, input) {
    const bottomContent = document.createElement('div');
    bottomContent.style = 'background: blue; height: 400px; width: 10px;';
    document.body.appendChild(bottomContent);

    const inputRect = input.getBoundingClientRect();
    const inputX = inputRect.x;
    const inputY = inputRect.y;

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@');

    const popupListWrapper = document.querySelector('.tribute-container');
    const menuRect = popupListWrapper.getBoundingClientRect();
    const menuX = menuRect.x;
    const menuY = menuRect.y;

    detachTribute(tribute, input.id);
    bottomContent.remove();
    clearDom();
    return { x: menuX, y: menuY };
  }

  it('should display a container menu in the same position when menuContainer is specified on an input as when the menuContainer is the body', async () => {
    let input = createDomElement();
    const container = input.parentElement;
    container.style = 'position: relative;';
    const { x: specifiedX, y: specifiedY } = await checkPosition(
      {
        menuContainer: container,
        values: [
          {
            key: 'Jordan Humphreys',
            value: 'Jordan Humphreys',
            email: 'getstarted@zurb.com',
          },
          {
            key: 'Sir Walter Riley',
            value: 'Sir Walter Riley',
            email: 'getstarted+riley@zurb.com',
          },
        ],
      },
      input,
    );

    input = createDomElement();
    const { x: unspecifiedX, y: unspecifiedY } = await checkPosition(
      {
        values: [
          {
            key: 'Jordan Humphreys',
            value: 'Jordan Humphreys',
            email: 'getstarted@zurb.com',
          },
          {
            key: 'Sir Walter Riley',
            value: 'Sir Walter Riley',
            email: 'getstarted+riley@zurb.com',
          },
        ],
      },
      input,
    );

    expect(unspecifiedY).to.equal(specifiedY);
    expect(unspecifiedX).to.equal(specifiedX);
  });

  it('should display a container menu in the same position when menuContainer is specified on an contenteditable as when the menuContainer is the body', async () => {
    let input = createDomElement('contenteditable');
    const container = input.parentElement;
    container.style = 'position: relative;';
    const { x: specifiedX, y: specifiedY } = await checkPosition(
      {
        menuContainer: container,
        values: [
          {
            key: 'Jordan Humphreys',
            value: 'Jordan Humphreys',
            email: 'getstarted@zurb.com',
          },
          {
            key: 'Sir Walter Riley',
            value: 'Sir Walter Riley',
            email: 'getstarted+riley@zurb.com',
          },
        ],
      },
      input,
    );

    input = createDomElement('contenteditable');
    const { x: unspecifiedX, y: unspecifiedY } = await checkPosition(
      {
        values: [
          {
            key: 'Jordan Humphreys',
            value: 'Jordan Humphreys',
            email: 'getstarted@zurb.com',
          },
          {
            key: 'Sir Walter Riley',
            value: 'Sir Walter Riley',
            email: 'getstarted+riley@zurb.com',
          },
        ],
      },
      input,
    );

    expect(unspecifiedY).to.equal(specifiedY);
    expect(unspecifiedX).to.equal(specifiedX);
  });
});

describe('Multi-char tests', () => {
  afterEach(() => {
    clearDom();
  });

  it('should display no menu when only first char of multi-char trigger is used', async () => {
    const input = createDomElement();

    const collectionObject = {
      trigger: '$(',
      selectTemplate: (item) => item.original.value,
      values: [
        {
          key: 'Jordan Humphreys',
          value: 'Jordan Humphreys',
          email: 'getstarted@zurb.com',
        },
        {
          key: 'Sir Walter Riley',
          value: 'Sir Walter Riley',
          email: 'getstarted+riley@zurb.com',
        },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, ' $');

    const popupListWrapper = document.querySelector('.tribute-container');
    expect(popupListWrapper).to.equal(null);

    detachTribute(tribute, input.id);
  });

  describe('Tribute events', () => {
    afterEach(() => {
      clearDom();
    });

    it('should raise tribute-active-true', async () => {
      const input = createDomElement();

      let called = false;
      const eventSpy = () => {
        called = true;
      };
      input.addEventListener('tribute-active-true', eventSpy);

      const collectionObject = {
        noMatchTemplate: function () {
          this.hideMenu();
        },
        selectTemplate: (item) => item.original.value,
        values: [
          { key: 'Tributação e Divisas', value: 'Tributação e Divisas' },
          { key: 'Tributação e Impostos', value: 'Tributação e Impostos' },
          { key: 'Tributação e Taxas', value: 'Tributação e Taxas' },
        ],
      };

      const tribute = attachTribute(collectionObject, input.id);
      await fillIn(input, '@random-text');

      const popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(called).to.be.true;

      detachTribute(tribute, input.id);
    });
  });

  describe('Tribute events', () => {
    afterEach(() => {
      clearDom();
    });

    it('should raise tribute-active-false', async () => {
      const input = createDomElement();

      let called = false;
      const eventSpy = () => {
        called = true;
      };
      input.addEventListener('tribute-active-false', eventSpy);

      const collectionObject = {
        noMatchTemplate: () => '',
        selectTemplate: (item) => item.original.value,
        values: [
          { key: 'Tributação e Divisas', value: 'Tributação e Divisas' },
          { key: 'Tributação e Impostos', value: 'Tributação e Impostos' },
          { key: 'Tributação e Taxas', value: 'Tributação e Taxas' },
        ],
      };

      const tribute = attachTribute(collectionObject, input.id);
      await fillIn(input, '@random-text');

      const popupList = document.querySelectorAll('.tribute-container > ul > li');
      expect(called).to.be.true;

      detachTribute(tribute, input.id);
    });
  });
});

describe('Tribute loadingItemTemplate', () => {
  afterEach(() => {
    clearDom();
  });

  // biome-ignore lint/complexity/noForEach: test code.
  ['text', 'contenteditable'].forEach((elementType) => {
    it(`Shows loading item template. For : ${elementType}`, async () => {
      const input = createDomElement(elementType);

      const collectionObject = {
        loadingItemTemplate: '<div class="loading">Loading</div>',
        values: (_, cb) => {
          setTimeout(
            () =>
              cb([
                {
                  key: 'Jordan Humphreys',
                  value: 'Jordan Humphreys',
                  email: 'getstarted@zurb.com',
                },
                {
                  key: 'Sir Walter Riley',
                  value: 'Sir Walter Riley',
                  email: 'getstarted+riley@zurb.com',
                },
              ]),
            500,
          );
        },
      };

      const tribute = attachTribute(collectionObject, input.id);

      await fillIn(input, '@J');

      const loadingItemTemplate = document.querySelectorAll('.loading');
      expect(loadingItemTemplate.length).to.equal(1);

      setTimeout(() => {
        const popupList = document.querySelectorAll('.tribute-container > ul > li');
        expect(popupList.length).to.equal(1);
        detachTribute(tribute, input.id);
      }, 1000);
    });
  });
});

describe('Tribute disabled items cases', () => {
  afterEach(() => {
    clearDom();
  });

  it('should prevent selecting disabled items with the mouse', async () => {
    const input = createDomElement();

    const collectionObject = {
      selectTemplate: (item) => item.original.value,
      values: [
        { key: 'First item', value: 'First item' },
        { key: 'Second item (disabled)', value: 'Second item (disabled)', disabled: true },
        { key: 'Third item', value: 'Third item' },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@');

    const popupList = document.querySelectorAll('.tribute-container > ul > li');
    simulateMouseClick(popupList[1]);
    expect(input.value).to.equal('@');
  });

  it('should prevent selecting disabled items with the keyboard', async () => {
    const input = createDomElement();

    const collectionObject = {
      selectTemplate: (item) => item.original.value,
      values: [
        { key: 'First item', value: 'First item' },
        { key: 'Second item (disabled)', value: 'Second item (disabled)', disabled: true },
        { key: 'Third item', value: 'Third item' },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@');

    //send down arrow
    await press('ArrowDown');

    //send enter
    await press('Enter');

    //The down arrow key navigation should have skipped the second so we should see
    //the third item in the text
    expect(input.value).to.equal('Third item ');

    //Now lets try again and test up arrow navigation
    await fillIn(input, '@');

    //send down arrow so we're on the 3rd item, then we can test the up arrow to go
    //back to the 1st
    await press('ArrowDown');

    //send up arrow
    await press('ArrowUp');

    //send enter
    await press('Enter');

    //The selection should have been on the first item when
    //we triggered enter, so the first item should be appended
    //to the existing text
    expect(input.value).to.equal('Third item First item ');

    detachTribute(tribute, input.id);
  });
});

describe('closeOnScroll tests', () => {
  afterEach(() => {
    clearDom();
  });

  it('Tribute should close when the window is scrolled', async () => {
    const input = createDomElement();

    const collectionObject = {
      trigger: '@',
      closeOnScroll: true,
      values: [
        { key: 'Jordan Humphreys', value: 'Jordan Humphreys', email: 'getstarted@zurb.com' },
        { key: 'Sir Walter Riley', value: 'Sir Walter Riley', email: 'getstarted+riley@zurb.com' },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@');

    expect(tribute.isActive).to.be.true;
    simulateElementScroll(window);

    // Need a slight delay otherwise we'll check for the result to fast
    setTimeout(() => {
      expect(tribute.isActive).to.be.false;
    }, 50);

    detachTribute(tribute, input.id);
  });

  it('Tribute should close when the container is scrolled', async () => {
    const input = createDomElement();
    const container = document.createElement('div');

    const collectionObject = {
      trigger: '@',
      closeOnScroll: container,
      values: [
        { key: 'Jordan Humphreys', value: 'Jordan Humphreys', email: 'getstarted@zurb.com' },
        { key: 'Sir Walter Riley', value: 'Sir Walter Riley', email: 'getstarted+riley@zurb.com' },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@');

    expect(tribute.isActive).to.be.true;
    simulateElementScroll(container);

    // Need a slight delay otherwise we'll check for the result to fast
    setTimeout(() => {
      expect(tribute.isActive).to.be.false;
    }, 50);

    detachTribute(tribute, input.id);
  });

  it('Tribute should not close when scrolled without the closeOnScroll set', async () => {
    const input = createDomElement();

    const collectionObject = {
      trigger: '@',
      values: [
        { key: 'Jordan Humphreys', value: 'Jordan Humphreys', email: 'getstarted@zurb.com' },
        { key: 'Sir Walter Riley', value: 'Sir Walter Riley', email: 'getstarted+riley@zurb.com' },
      ],
    };

    const tribute = attachTribute(collectionObject, input.id);
    await fillIn(input, '@');

    expect(tribute.isActive).to.be.true;
    simulateElementScroll(window);

    // Need a slight delay otherwise we'll check for the result to fast
    setTimeout(() => {
      expect(tribute.isActive).to.be.true;
    }, 50);

    detachTribute(tribute, input.id);
  });
});
