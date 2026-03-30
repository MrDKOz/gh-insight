// Backwards-compatibility shim — new code should import from ./appReducer directly.
export type { Action } from "./appReducer";
export { appReducer as milestoneReducer, initialState } from "./appReducer";
