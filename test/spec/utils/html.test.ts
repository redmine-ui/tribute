import { expect } from 'chai';
import { h } from '../../../src/html';

describe('h function', () => {
  describe('Flexible argument signatures', () => {
    it('should support h("span", "hello, world!", {class: "hoge"})', () => {
      const el = h('span', 'hello, world!', { class: 'hoge' });
      expect(el.outerHTML).to.equal('<span class="hoge">hello, world!</span>');
    });

    it('should support h("span", {class: "hoge"})', () => {
      const el = h('span', { class: 'hoge' });
      expect(el.outerHTML).to.equal('<span class="hoge"></span>');
    });

    it('should support h("span", {class: "hoge"}, "hello!!", h("span", "world!!!"))', () => {
      const el = h('span', { class: 'hoge' }, 'hello!!', h('span', 'world!!!'));
      expect(el.outerHTML).to.equal('<span class="hoge">hello!!<span>world!!!</span></span>');
    });
  });

  describe('Element Creation & Text Content', () => {
    it('should create an HTML element with no attributes or children', () => {
      const el = h('div');
      expect(el.tagName).to.equal('DIV');
      expect(el.childNodes.length).to.equal(0);
    });

    it('should create an element with text content passed directly', () => {
      const el = h('span', 'Hello World');
      expect(el.tagName).to.equal('SPAN');
      expect(el.textContent).to.equal('Hello World');
    });

    it('should append multiple text nodes and elements as children', () => {
      const el = h('div', 'Item 1', h('span', 'Item 2'));
      expect(el.childNodes.length).to.equal(2);
      expect(el.innerHTML).to.equal('Item 1<span>Item 2</span>');
    });
  });

  describe('Attributes and Properties Handling', () => {
    it('should set standard attributes', () => {
      const el = h('input', { type: 'text', id: 'username' });
      expect(el.getAttribute('type')).to.equal('text');
      expect(el.getAttribute('id')).to.equal('username');
    });

    it('should handle class names passed as string or array', () => {
      const elString = h('div', { class: 'btn primary' });
      expect(elString.className).to.equal('btn primary');

      const elArray = h('div', { class: ['btn', 'active'] });
      expect(elArray.className).to.equal('btn active');
    });

    it('should populate dataset attributes', () => {
      const el = h('div', {
        data: {
          testId: 'submit-btn',
          count: 42,
          enabled: true,
        },
      });
      expect(el.dataset.testId).to.equal('submit-btn');
      expect(el.dataset.count).to.equal('42');
      expect(el.dataset.enabled).to.equal('true');
    });

    it('should apply style declarations', () => {
      const el = h('div', {
        style: {
          color: 'red',
          display: 'flex',
        },
      });
      expect(el.style.color).to.equal('red');
      expect(el.style.display).to.equal('flex');
    });

    it('should attach event listeners for on-prefixed keys', () => {
      let clicked = false;
      const el = h('button', {
        onclick: () => {
          clicked = true;
        },
      });

      el.click();
      expect(clicked).to.be.true;
    });

    it('should set boolean attributes correctly', () => {
      const el = h('button', { disabled: true, hidden: false });
      expect(el.hasAttribute('disabled')).to.be.true;
      expect(el.hasAttribute('hidden')).to.be.false;
    });
  });

  describe('Raw HTML & Security', () => {
    it('should safely escape normal strings', () => {
      const scriptTag = '<script>alert("xss")</script>';
      const el = h('div', scriptTag);

      expect(el.children.length).to.equal(0);
      expect(el.textContent).to.equal(scriptTag);
    });
  });

  describe('Nested Children and Variadic Arguments', () => {
    it('should handle array of children correctly', () => {
      const children = [h('li', 'A'), h('li', 'B')];
      const el = h('ul', { class: 'list' }, children);

      expect(el.children.length).to.equal(2);
      expect(el.children[0]?.textContent).to.equal('A');
      expect(el.children[1]?.textContent).to.equal('B');
    });

    it('should support nesting multiple levels of h calls', () => {
      const tree = h('nav', { id: 'main-nav' }, h('ul', h('li', 'Home'), h('li', 'About')));

      expect(tree.outerHTML).to.equal('<nav id="main-nav"><ul><li>Home</li><li>About</li></ul></nav>');
    });
  });
});
