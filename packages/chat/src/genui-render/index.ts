// Public surface of @intentface/chat/genui-render. No directive — see
// index.parts.ts. The schemas, checks and Markdown it draws against are
// @intentface/chat/genui, which carries no React.

export { copyWithGenUi } from "./copy";
export type {
  GenUiComponentMap,
  GenUiComponents,
  GenUiElementProps,
  GenUiFallbackProps,
  GenUiPartProps,
  GenUiRootProps,
  GenUiSpecProps,
  GenUiStateChangeDetails,
  GenUiViewComponentProps,
  GenUiViewProps,
} from "./genui-render";
export { defineComponents, useGenUiElement, useGenUiLive, useSteady } from "./genui-render";
export * as GenUi from "./index.parts";
