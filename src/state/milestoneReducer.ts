// Backwards-compatibility shim — new code should import from ./appReducer directly.
export type { AppState as MilestoneState } from "./appReducer";
export type { Action } from "./appReducer";
export { appReducer as milestoneReducer, initialState } from "./appReducer";
