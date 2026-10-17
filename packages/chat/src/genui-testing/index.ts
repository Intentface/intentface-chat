// Public surface of @intentface/chat/genui-testing: fixtures and conformance
// checks for a component map. Needs a DOM and `@testing-library/dom`, so it is
// its own entry, outside the pure core and outside anything a page loads.

export { type Fixture, fixtures } from "../genui/fixtures";
export { type ConformanceOptions, checkComponents } from "./conformance";
