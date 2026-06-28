import { 
  getRepoContents, 
  getFileContent, 
  updateFileWithPR 
} from '../../lib/github.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, owner, repo, path, content, commitMessage, prTitle, prBody, baseBranch } = req.body;

  try {
    let result;

    switch (action) {
      case 'getContents':
        result = await getRepoContents(owner, repo, path || '');
        break;
      case 'getFile':
        result = await getFileContent(owner, repo, path);
        break;
      case 'updateFile':
        result = await updateFileWithPR(
          owner, 
          repo, 
          path, 
          content, 
          commitMessage, 
          prTitle, 
          prBody, 
          baseBranch || 'main'
        );
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.status(200).json({ data: result });
  } catch (error) {
    console.error('GitHub API error:', error);
    res.status(500).json({ error: error.message });
  }
}
