import { onRequest as __api_markers_ts_onRequest } from "/Users/w.griffiths/Desktop/Claude Projects/londonmarathon/functions/api/markers.ts"

export const routes = [
    {
      routePath: "/api/markers",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_markers_ts_onRequest],
    },
  ]