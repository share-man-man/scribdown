---
name: submit-scribdown
description: 将 Scribdown 当前任务改动按固定流程提交为 Pull Request：从最新 main 新建 codex/ 分支，生成或补充 Changeset，执行校验，提交并推送代码，再用宿主机 gh 创建 PR。用户提出“提交”“提交改动”“开 PR”“提 PR”“生成 changeset 并提交”或要求完成从改动到 PR 的整套流程时使用。流程止于创建 PR，不合并 PR、不触发 GitHub Actions、不执行正式发布。
---

# 提交 Scribdown

将当前任务改动整理为一个可审查的 PR。严格遵守以下顺序，除非用户明确缩小范围。

## 遵守操作边界

- 从仓库根目录操作。
- 所有 `git`、`pnpm`、`npm` 和 `node` 命令都通过 `mise exec -- ...` 执行。
- 保留与本次任务无关的改动，不使用 `git add .`、`git add -A`、`git stash`、`git reset` 或其他会混入、隐藏、覆盖改动的操作。
- 仅完成建分支、Changeset、校验、提交、推送和创建 PR。
- 不合并 PR，不调用 `gh workflow run`，不执行 `pnpm version-packages` 或 `pnpm release`。最终正式发布必须由用户在 GitHub Actions 页面手动触发。

## 1. 盘点当前状态

执行：

```bash
mise exec -- git status --short
mise exec -- git branch --show-current
mise exec -- git diff --stat
mise exec -- git diff
mise exec -- git log --oneline --decorate -12
```

识别本次任务文件和无关改动。若无法可靠区分，先向用户确认，不要擅自提交。

## 2. 从 main 新建分支

1. 执行 `mise exec -- git fetch origin main`，以 `origin/main` 作为最新基线。
2. 生成简短、语义明确的小写 kebab-case 分支名，并使用 `codex/` 前缀。
3. 当前位于 `main` 时，执行 `mise exec -- git switch -c codex/<slug> origin/main`。未提交改动会在 Git 判断安全时保留到新分支。
4. 当前已在其他分支时，检查它与 `origin/main` 的关系。若其中已有本次任务提交，或无法无损地从 `origin/main` 重建，不要自动 stash、reset、cherry-pick 或 rebase；说明情况并取得用户决定。
5. 切换失败时保持现场，不用破坏性命令强行处理。

## 3. 生成 Changeset

根据行为变化和公开接口判断受影响项目，不只按文件路径判断：

- 兼容性修复使用 `patch`。
- 向后兼容的新功能使用 `minor`。
- 不兼容的公开变更使用合适的破坏性升级级别。
- 使用简洁中文写面向用户的摘要。
- 应用商店版本需要变化时，纳入 `@scribdown/browser-extension` 或 `scribdown-markdown-preview`。
- 让 Changesets 自动处理内部依赖升级；不要仅因依赖了被修改的内部包就重复加入。

优先直接在 `.changeset/` 创建小写 kebab-case 文件，格式如下：

```markdown
---
"@scribdown/受影响包": patch
---

简洁说明用户可感知的变化。
```

每次提交都必须包含一个新的 Changeset。若改动仅涉及文档、测试、CI、skill 或其他不应提升任何包版本的内容，执行 `mise exec -- pnpm changeset --empty` 生成 empty Changeset，并写清该变更的目的。不要手工修改版本号或 changelog。

## 4. 校验改动

先执行与改动直接相关的测试，再执行仓库基线：

```bash
mise exec -- pnpm lint
mise exec -- pnpm typecheck
mise exec -- pnpm test
mise exec -- pnpm build
mise exec -- pnpm changeset status --since=origin/main
```

若失败，先修复属于本次任务的问题并重新校验。若失败与本次任务无关或无法安全修复，停止提交并报告，不得把失败包装成成功。

## 5. 提交并推送

1. 再次审查 `mise exec -- git status --short` 和 `mise exec -- git diff`。
2. 使用 `mise exec -- git add <明确路径...>` 逐项暂存本次任务文件与对应 Changeset，不暂存无关文件。
3. 用 `mise exec -- git diff --cached` 检查最终提交内容。
4. 采用与仓库历史一致的 Conventional Commit 标题，例如 `fix: ...`、`feat(scope): ...` 或 `chore: ...`。
5. 执行 `mise exec -- git commit -m "<标题>"`，不要添加 `Co-Authored-By`。
6. 执行 `mise exec -- git push -u origin HEAD`。若网络沙箱阻止推送，按宿主机授权流程重试，不改用其他远端或凭据。

## 6. 使用宿主机 gh 创建 PR

沙箱内的 `gh` 没有登录。不要先在沙箱内尝试，也不要把鉴权失败当成用户未登录。

1. 调用命令执行工具时设置 `sandbox_permissions: "require_escalated"`，直接在宿主机运行 `gh auth status` 和 `gh pr create`；不要先执行一次沙箱内命令来等待失败。
2. PR 的 base 固定为 `main`，head 为当前分支。
3. PR 标题与提交主题一致；正文至少包含“改动摘要”“Changeset”“验证结果”。
4. 创建命令使用 `gh pr create --base main --head <branch> --title <title> --body <body>`；不要使用 `--web`，不要自动合并。
5. 返回 PR URL、分支名、提交哈希、Changeset 升级范围和校验结果。

创建 PR 后立即停止。提醒用户：后续合并及最终发布不属于本 skill；正式发布由用户在 GitHub Actions 页面手动触发。
