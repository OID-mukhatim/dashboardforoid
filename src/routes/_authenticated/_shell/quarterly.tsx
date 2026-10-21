import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/_shell/quarterly")({
  beforeLoad: () => { throw redirect({ to: "/activities", replace: true }); },
});
