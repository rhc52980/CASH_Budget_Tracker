import { createContext, useContext } from "react";

// App-wide context: { dark, chart, expenseCats, allCats, catColor }
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
