import { Octokit } from 'octokit';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN
});

export async function getRepoContents(owner, repo, path = '') {
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path
  });
  
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return [response.data];
}

export async function getFileContent(owner, repo, path) {
  const response = await octokit.rest.repos.getContent({
    owner,
    repo,
    path
  });
  
  const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
  return { content, sha: response.data.sha };
}

export async function createBranch(owner, repo, baseBranch, newBranch) {
  const refResponse = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`
  });
  
  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${newBranch}`,
    sha: refResponse.data.object.sha
  });
  
  return newBranch;
}

export async function commitFile(owner, repo, branch, path, content, message, sha = null) {
  const params = {
    owner,
    repo,
    branch,
    path,
    message,
    content: Buffer.from(content).toString('base64')
  };
  
  if (sha) {
    params.sha = sha;
  }
  
  const response = await octokit.rest.repos.createOrUpdateFileContents(params);
  return response.data.commit;
}

export async function createPullRequest(owner, repo, title, body, head, base) {
  const response = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base
  });
  
  return response.data;
}

export async function updateFileWithPR(owner, repo, filePath, newContent, commitMessage, prTitle, prBody, baseBranch = 'main') {
  // Get current file
  let sha = null;
  try {
    const file = await getFileContent(owner, repo, filePath);
    sha = file.sha;
  } catch (e) {
    // File doesn't exist yet
  }
  
  // Create a new branch
  const branchName = `update-${filePath.replace(/\//g, '-')}-${Date.now()}`;
  await createBranch(owner, repo, baseBranch, branchName);
  
  // Commit the file
  await commitFile(owner, repo, branchName, filePath, newContent, commitMessage, sha);
  
  // Create PR
  const pr = await createPullRequest(owner, repo, prTitle, prBody, branchName, baseBranch);
  
  return pr;
}
