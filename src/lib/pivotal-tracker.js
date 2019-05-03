"use strict";
const querystring = require("querystring");
const Server = require("./pivotal-server");
const debug = require("debug")("hubot:civ2:pivotal");

class PivotalTracker {
  constructor(token, project) {
    this.projectId = project;
    this.server = new Server(token);
  }

  async getStory(id) {
    debug.enabled && debug(`Getting story ${id}`);

    const root = getProjectRoot(this.projectId);
    return this.server.get(`${root}/stories/${id}`);
  }

  async getStories(filters) {
    debug.enabled && debug(`getting stories`);

    const filtersQuerystring = querystring.stringify(filters);
    const root = getProjectRoot(this.projectId);

    return this.server.get(`${root}/stories?${filtersQuerystring}`);
  }
  async updateStory(story, updates, options) {
    debug.enabled && debug(`updating story ${story.id}`);
    const root = getProjectRoot(this.projectId);

    return this.server.put(`${root}/stories/${story.id}`, updates, options);
  }
  async updateStories(stories, updates, options) {
    const ids = stories.map(story => story.id).join(",");
    debug.enabled && debug(`updating stories ${ids}`);

    const jobs = stories.map(story =>
      this.updateStory(story, updates, options)
    );
    return Promise.all(jobs);
  }
  async deliver(stories, options) {
    const ids = stories.map(story => story.id).join(",");
    debug.enabled && debug(`delivering stories ${ids}`);

    return this.updateStories(stories, { current_state: "delivered" }, options);
  }
  async addLabels(stories, labelsToAdd, options) {
    const ids = stories.map(story => story.id).join(",");
    debug.enabled && debug(`Setting labels ${labelsToAdd} on stories ${ids}`);

    const newLabels = labelsToAdd.map(label => ({ name: label }));
    const failed = [];
    for (const story of stories) {
      const labels = (story.labels || []).concat(newLabels);
      try {
        await this.updateStory(story, { labels }, options);
      } catch (error) {
        failed.push({ story, error });
      }
    }
    debug.enabled && debug(`Failed updates : ${failed}`);
    if (failed.length > 0) {
      throw new Error(`${failed.length} stories failed to update`);
    }
  }
  changelog(stories, options = {}) {
    debug.enabled &&
      debug(`Generating changelog for ${stories.length} storie(s)`);
    const markdown = generateChangelogs(
      stories,
      Object.assign({}, options, { markdown: true })
    );
    const txt = generateChangelogs(
      stories,
      Object.assign({}, options, { markdown: false })
    );
    return { markdown, txt };
  }
}

module.exports = PivotalTracker;

function generateChangelogs(stories, options = {}) {
  const repos = stories.reduce(
    (repos, story) => {
      const formattedStory = formatStoryForChangelog(story, options);
      let hasRepo = false;
      for (const label of story.labels) {
        if (label.name.startsWith("repo/")) {
          const repo = label.name.replace("repo/", "");
          repos[repo] = repos[repo] || [];
          repos[repo].push(formattedStory);
          hasRepo = true;
        }
      }
      if (!hasRepo) {
        repos.other.push(formattedStory);
      }
      return repos;
    },
    { other: [] }
  );
  for (const repo of Object.keys(repos)) {
    repos[repo] = repos[repo].join("\n");
  }
  const all = stories
    .map(story => formatStoryForChangelog(story, options))
    .join("\n");
  return { repos, all };
}

function formatStoryForChangelog({ id, name, url, labels }, options) {
  const strLabels = options.withRepositories ? getRepoLabelsList(labels) : "";
  const reposList = strLabels !== "" ? ` (${strLabels})` : "";

  if (options.markdown) {
    return ` * ${name} ([#${id}](${url}))${reposList}`;
  }
  return ` - ${name} (#${id})${reposList}`;
}

function getRepoLabelsList(labels = []) {
  return labels
    .filter(({ name }) => name.includes("repo/"))
    .map(({ name }) => name.replace("repo/", ""))
    .join(",");
}

function getProjectRoot(id) {
  return `/services/v5/projects/${id}`;
}
