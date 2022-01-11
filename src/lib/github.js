exports.getPR = function (body) {
  if (body.pull_request) {
    const { id, pull_request, action } = body;
    const branch = pull_request.head.ref;
    const repo = pull_request.head.repo.name;
    const base = pull_request.base.ref;
    const { merged, merge_commit_sha } = pull_request;

    return { id, repo, branch, base, merged, merge_commit_sha, action };
  }
};
