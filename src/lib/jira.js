'use strict';

const JiraClient = require('jira-connector');

module.exports = class Jira {
  constructor(host, email, api_token) {
    this._projects = null;
    this.host = host;

    this.jira = new JiraClient({ host, basic_auth: { email, api_token } });
  }

  static initialize() {
    const { JIRA_HOST, JIRA_USER, JIRA_TOKEN } = process.env;
    return JIRA_HOST && JIRA_USER && JIRA_TOKEN ? new Jira(JIRA_HOST, JIRA_USER, JIRA_TOKEN) : null;
  }

  makeLink(issueKey) {
    return `https://${this.host}/browse/${issueKey}`;
  }

  async getProjectsKeys() {
    if (!this._projects) {
      const projects = await this.jira.project.getAllProjects();
      this._projects = projects.map((project) => ({
        ...project,
        keyRegexp: new RegExp(`${project.key}-[0-9]+`),
      }));
    }

    return this._projects;
  }

  async getIdFromBranchName(branchName) {
    const projects = await this.getProjectsKeys();
    for (const { keyRegexp } of projects) {
      const match = branchName.match(keyRegexp);

      if (match) {
        return match[0];
      }
    }

    return null;
  }

  async getIssue(issueKey) {
    return this.jira.issue.getIssue({ issueKey });
  }

  async getStory(issueKey) {
    const issue = await this.getIssue(issueKey);
    const { summary, description } = issue.fields;
    return { id: issueKey, name: summary, description };
  }
};
