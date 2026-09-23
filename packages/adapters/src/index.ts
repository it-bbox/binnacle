export {
  commitTree,
  isAncestor,
  isUnavailable as isGitUnavailable,
  readCommit,
  readCommitBefore,
  readGitFacts,
  readGitLocation,
  readLastCommitTimes,
  readLog,
  type Commit,
  type GitFacts,
  type GitLocation,
  type GitRemote,
} from './git.ts';
export { readLocalTasks } from './local-tracker.ts';
export { EMPTY_TREE, workingTree, type Tree, type TreeEntry } from './tree.ts';
