exports.getPRMerge = function(body) {
  if (body.pull_request) {
    const branch = body.pull_request.head.ref;
    const repo = body.pull_request.head.repo.name;
    if (
      body.action &&
      body.action === "closed" &&
      body.pull_request.merged === true
    ) {
      return `branch ${branch} of ${repo} can be archived now !`;
    }
  }
};
