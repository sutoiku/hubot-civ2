exports.getPRMerge = function(body) {
  if (body.pull_request) {
    const { id, pull_request, action } = body;
    const branch = pull_request.head.ref;
    const repo = pull_request.head.repo.name;
    const base = pull_request.base.ref;
    if (action && action === "closed" && pull_request.merged === true) {
      return { id, repo, branch, base };
    }
  }
};
