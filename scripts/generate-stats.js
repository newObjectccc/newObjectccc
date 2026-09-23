#!/usr/bin/env node
/**
 * Generates dist/github-stats.svg for the profile README.
 *
 * Dependency-free (Node 18+), uses the public GitHub REST API only.
 * Rendered by GitHub Actions on a schedule and pushed to the `output`
 * branch, so the README never depends on third-party image hosts.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const USER = process.env.GITHUB_USER || 'newObjectccc';
const DISPLAY_NAME = process.env.DISPLAY_NAME || "vesper's GitHub stats";
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const API = 'https://api.github.com';

const headers = {
  'User-Agent': 'readme-stats-generator',
  Accept: 'application/vnd.github+json',
};
if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

async function getJSON(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url}\n${await res.text()}`);
  }
  return res.json();
}

async function getAllRepos() {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await getJSON(
      `${API}/users/${USER}/repos?per_page=100&page=${page}&sort=updated`
    );
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

async function searchTotal(query) {
  const data = await getJSON(
    `${API}/search/issues?q=${encodeURIComponent(query)}&per_page=1`
  );
  return data.total_count;
}

function formatNumber(n) {
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(n);
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const [user, repos, prs, issues] = await Promise.all([
    getJSON(`${API}/users/${USER}`),
    getAllRepos(),
    searchTotal(`author:${USER} type:pr`),
    searchTotal(`author:${USER} type:issue`),
  ]);

  const owned = repos.filter((r) => !r.fork);
  const totalStars = owned.reduce((sum, r) => sum + r.stargazers_count, 0);
  const totalForks = owned.reduce((sum, r) => sum + r.forks_count, 0);

  const stats = [
    ['Total Stars', formatNumber(totalStars), '#fabd2f'],
    ['Pull Requests', formatNumber(prs), '#fe8019'],
    ['Total Forks', formatNumber(totalForks), '#83a598'],
    ['Issues', formatNumber(issues), '#d3869b'],
    ['Followers', formatNumber(user.followers), '#b8bb26'],
    ['Public Repos', formatNumber(user.public_repos), '#8ec07c'],
  ];

  // 2 columns x 3 rows layout, github-readme-stats classic style.
  const cols = [25, 245];
  const rows = [82, 112, 142];
  const items = stats
    .map(([label, value, color], i) => {
      const x = cols[i % 2];
      const y = rows[Math.floor(i / 2)];
      return (
        `  <circle cx="${x + 5}" cy="${y - 5}" r="5" fill="${color}"/>\n` +
        `  <text x="${x + 18}" y="${y}" font-size="14">\n` +
        `    <tspan fill="#a89984">${escapeXml(label)}:</tspan>` +
        `<tspan fill="${color}" font-weight="bold"> ${escapeXml(value)}</tspan>\n` +
        `  </text>`
      );
    })
    .join('\n');

  const updated = new Date().toISOString().slice(0, 10);
  const fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="450" height="195" viewBox="0 0 450 195" role="img" aria-label="${escapeXml(DISPLAY_NAME)}">
  <style>
    text { font-family: ${fontFamily}; }
  </style>
  <rect x="0.5" y="0.5" width="449" height="194" rx="4.5" fill="#282828" stroke="#3c3836"/>
  <text x="25" y="38" font-size="18" font-weight="bold" fill="#fabd2f">${escapeXml(DISPLAY_NAME)}</text>
  <line x1="25" y1="52" x2="425" y2="52" stroke="#3c3836"/>
${items}
  <text x="425" y="177" font-size="11" fill="#7c6f64" text-anchor="end">Updated on ${updated}</text>
</svg>
`;

  const outDir = path.join(process.cwd(), 'dist');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'github-stats.svg'), svg);
  console.log(`Wrote dist/github-stats.svg (user: ${USER})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
