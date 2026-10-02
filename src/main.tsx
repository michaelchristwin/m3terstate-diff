import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getRouter } from "./router";
import { PonderProvider } from "@ponder/react";
import { ponderClient } from "./queries";

const router = getRouter();
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
ReactDOM.createRoot(document.getElementById("app")!).render(
  <PonderProvider client={ponderClient}>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </PonderProvider>,
);
