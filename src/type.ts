export type Collection<T extends {}> = TributeCollection<T> & TributeTemplateWithDefault<T>;

export interface ITribute<T extends {}> {
  autocompleteMode: boolean;
  autocompleteSeparator: RegExp | null;
  allowSpaces: boolean;
  closeOnScroll: boolean | HTMLElement;
  current: ITributeContext<T>;
  collection: Collection<T>[];
  menu: ITributeMenu<T>;
  hideMenu(): void;
  range: ITributeRange<T>;
  search: ITributeSearch<T>;
  hasTrailingSpace: boolean;
  isActive: boolean;
  menuContainer?: Element | null;
  hideMenu: () => void;
  positionMenu: boolean;
  replaceTextSuffix: string | null;
  showMenuFor(element: Element, scrollTo?: boolean): void;
  showMenuForCollection(element: HTMLElement, collectionIndex?: number): void;
  spaceSelectsMatch: boolean;
  selectItemAtIndex(index: string, originalEvent: Event): void;
  triggers(): (string | undefined)[];
}

export interface ITributeContext<T extends {}> {
  element?: HTMLElement;
  filteredItems?: TributeItem<T>[];
  collection?: Collection<T>;
  mentionText: string;
  isMentionLengthUnderMinimum: boolean | undefined;
  externalTrigger: boolean;
  process(scrollTo?: boolean): void;
  trigger?: string;
  updateSelection(info: TriggerInfo): void;
}

export type Coordinate = {
  top?: number | 'auto';
  left?: number | 'auto';
  right?: number | 'auto';
  bottom?: number | 'auto';
  height?: number;
  width?: number;
  maxHeight?: number;
  maxWidth?: number;
  position?: string;
};

export type TriggerInfo = {
  mentionPosition: number;
  mentionText: string | undefined;
  mentionSelectedElement: unknown;
  mentionSelectedPath: (number | undefined)[] | undefined;
  mentionSelectedOffset?: number;
  mentionTriggerChar?: string;
};

export interface ITributeMenu<T extends {}> {
  element: HTMLElement | null;
  activate(): void;
  deactivate(): void;
  isActive: boolean;
  create(doc: Document, containerClass: string): HTMLElement;
  getDimensions(): { height: number | null; width: number | null };
  selected: number;
  setActiveLi(index: number): void;
  positionAtCaret(info: unknown, coordinates: Coordinate): void;
  up(count: number): void;
  down(count: number): void;
  unselect(): void;
}

export interface ITributeEvents {
  bind(element: HTMLElement): void;
  unbind(element: HTMLElement): void;
}

export interface ITributeRange<T extends {}> {
  getDocument(): Document;
  positionMenuAtCaret(scrollTo?: boolean): void;
  replaceTriggerText(text: string | HTMLElement, requireLeadingSpace: boolean, hasTrailingSpace: boolean, originalEvent: Event, item: TributeItem<T>): void;
  getTriggerInfo(
    menuAlreadyActive: boolean,
    hasTrailingSpace: boolean,
    requireLeadingSpace: boolean,
    allowSpaces: boolean,
    isAutocomplete: boolean,
  ): TriggerInfo | undefined;
}

export interface ITributeSearch<T extends {}> {
  filter(pattern: string, arr: T[], opts?: TributeSearchOpts<T>): TributeItem<T>[];
}

export type TributeItem<T extends {}> = {
  index: number;
  original: T;
  score: number;
  string: string;
};

export type TributeSearchOpts<T extends {}> = {
  pre?: string;
  post?: string;
  skip?: boolean;
  caseSensitive?: boolean;
  extract?: (element: T & { [key: string]: string }) => string | null | undefined;
};

export type TributeCollection<T extends {}> = {
  // symbol that starts the lookup
  trigger: string;

  // element to target for @mentions
  iframe?: HTMLIFrameElement | null;

  // is it wrapped in a web component
  shadowRoot?: (ShadowRoot & { getSelection(): Selection }) | null;

  // class added in the flyout menu for active item
  selectClass: string;

  // class added in the flyout menu for active item
  containerClass: string;

  // class added to each list item
  itemClass: string;

  // specify an alternative parent container for the menu
  menuContainer?: Element | null;

  // column to search against in the object (accepts function or string)
  lookup?: string | ((item: T, mentionText: string) => string);

  // column that contains the content to insert by default
  fillAttr: string;

  // array of objects to match
  values: Array<T> | ((text: string, cb: (result: Array<T>) => void) => void) | null;

  // When your values function is async, an optional loading template to show
  loadingItemTemplate: string | null;

  // specify whether a space is required before the trigger character
  requireLeadingSpace?: boolean;

  // specify whether a space is allowed in the middle of mentions
  allowSpaces?: boolean;

  // optionally specify a custom suffix for the replace text
  // (defaults to empty space if undefined)
  replaceTextSuffix?: string | null;

  //specify whether the menu should be positioned
  positionMenu?: boolean;

  // specify if the current match should be selected when the spacebar is hit
  spaceSelectsMatch?: boolean;

  //specify whether to put Tribute in autocomplete mode
  autocompleteMode?: boolean;

  // Customize the elements used to wrap matched strings within the results list
  searchOpts: TributeSearchOpts<T>;

  // Limits the number of items in the menu
  menuItemLimit?: number | null;

  // require X number of characters to be entered before menu shows
  menuShowMinLength: number;

  // Fix for maximum number of items added to the input for the specific Collection
  maxDisplayItems?: number | null;

  isBlocked?: boolean;
};

export type TributeTemplate<T extends {}> = {
  // function called on select that returns the content to insert
  selectTemplate?: ((item: TributeItem<T> | undefined) => string | HTMLElement) | null;

  // template for displaying item in menu
  menuItemTemplate?: ((item: TributeItem<T>) => string | HTMLElement) | null;

  // template for when no match is found (optional),
  // If no template is provided, menu is hidden.
  noMatchTemplate?: (() => string) | string | null;
};

export type TributeTemplateWithDefault<T extends {}> = {
  // function called on select that returns the content to insert
  selectTemplate: (item: TributeItem<T> | undefined) => string | HTMLElement;

  // template for displaying item in menu
  menuItemTemplate: (item: TributeItem<T>) => string | HTMLElement;

  // template for when no match is found (optional),
  // If no template is provided, menu is hidden.
  noMatchTemplate: (() => string) | string | null;
};

export type TributeArgument<T extends {}> = {
  // specify a regex to define after which characters the autocomplete option should open
  // If null is used then it will not split the string & search in the whole line
  // default value is /\s+/ means it will split on whitespace when this is not specified
  autocompleteSeparator?: RegExp | null;

  // specify whether to close when scrolled, and optionally an element to bind
  // the scroll event to.
  closeOnScroll?: boolean | HTMLElement;

  // pass an array of config objects
  collection: (TributeCollection<T> & TributeTemplate<T>)[] | null;
};

export type TributeElement = HTMLElement | NodeList | HTMLCollection | Array<HTMLElement>;
