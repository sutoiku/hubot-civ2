'use strict';

// TODO always use jira.js, remove deprecated jira-connector
const JiraClient = require('jira-connector');
const { Version2Client } = require('jira.js');
const jira2md = require('jira2md');

const MAX_RESULTS = 1000;

module.exports = class Jira {
  constructor(host, email, api_token) {
    this._projects = null;
    this.host = host;

    this.jira = new JiraClient({ host, basic_auth: { email, api_token } });
    this.client = new Version2Client({
      host: `https://${host}`,
      authentication: { basic: { email, apiToken: api_token } },
    });
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
      await this._initProjectsList();
    }

    return this._projects;
  }

  async _initProjectsList() {
    const projects = await this.jira.project.getAllProjects();
    this._projects = projects.map((project) => ({
      ...project,
      keyRegexp: new RegExp(`${project.key}-[0-9]+`),
    }));
  }

  async getProjectIdByKey(expectedKey) {
    await this._initProjectsList();
    for (const { key, id } of this._projects) {
      if (key === expectedKey) {
        return id;
      }
    }

    return null;
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
    const description = jira2md.to_markdown(issue.fields.description);
    return { id: issueKey, name: issue.fields.summary, description };
  }

  // -----------------------------------------------------------------------------
  // RELEASE
  // -----------------------------------------------------------------------------

  async createNewVersion(key, name, options = {}) {
    const { released = false } = options;
    return this.client.projectVersions.createVersion({ name, released, projectId: await this.getProjectIdByKey(key) });
  }

  async releaseVersion(versionId) {
    const releaseDate = genReleaseDate();
    await this.client.projectVersions.updateVersion({ id: versionId, released: true, releaseDate });
  }

  async listIssuesToRelease(key) {
    const jql = `status=Accepted AND fixVersion=EMPTY AND project=${key}`;

    const reqParams = { maxResults: MAX_RESULTS, jql };
    const { total, issues: allIssues } = await this.client.issueSearch.searchForIssuesUsingJql(reqParams);

    while (allIssues.length < total) {
      const pageParams = { ...reqParams, startAt: allIssues.length };
      const { issues } = await this.client.issueSearch.searchForIssuesUsingJql(pageParams);
      allIssues.push(...issues);
    }

    return allIssues;
  }

  async setIssuesVersion(issuesIds, versionId) {
    const allUpdates = [];

    // TODO add delay to avoid frequency violation ?
    for (const issueId of issuesIds) {
      const issueParams = { issueIdOrKey: issueId, fields: { fixVersions: [{ id: versionId }] } };
      allUpdates.push(this.client.issues.editIssue(issueParams));
    }
  }
};

function genReleaseDate() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
