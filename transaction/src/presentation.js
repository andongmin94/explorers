// Database changes become visible together. The requesting client receives its
// result only when the response arrives; a waiting request has no response yet.
export function getPresentationState(step, phase) {
  switch (phase) {
    case "request":
      return step.before;
    case "complete":
      return step.state;
    case "database": {
      if (step.action === "wait") return step.state;
      const client = step.action.startsWith("resume")
        ? { ...step.before.clients[step.client], status: "active" }
        : step.before.clients[step.client];
      return {
        ...step.state,
        clients: { ...step.state.clients, [step.client]: client },
      };
    }
  }
}
