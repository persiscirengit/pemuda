# Agent Environment Setup Guide

This guide describes how to configure the unified multi-agent development environment for **`omp`**, **`agy`**, **`codex`**, and **`claude`**. The repository standardizes strictly on two shared agent tools: **`superpowers`** (workflow methodology) and **`context7` MCP** (official library documentation). Contributors retain complete freedom over their personal terminal and token preferences.

## 1. Install Superpowers Plugin

The `superpowers` plugin provides structured planning, TDD execution, and verification workflows.

### For Antigravity (`agy`)

```bash
agy plugin install https://github.com/obra/superpowers
```

### For Claude Code (`claude`)

Run inside the Claude Code session:
```text
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

### For Codex (`codex`)

Open the plugin manager within Codex:
```text
/plugins -> search and enable "superpowers"
```

### For OpenMultiPlatform (`omp`)

```bash
pi install git:github.com/obra/superpowers
```

## 2. Configure Context7 MCP

The `context7` MCP server gives agents live access to current documentation and APIs across the modern `@latest` ecosystem.

### For Antigravity (`agy`)

Add to `~/.gemini/config/mcp_config.json` (or project-level MCP configuration):
```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
```

### For Claude Code (`claude`)

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

### For Codex (`codex`)

Add to `~/.codex/config.toml`:
```toml
[mcp.servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
```

### For OpenMultiPlatform (`omp`)

Configure the `context7` endpoint in your MCP server registry pointing to `@upstash/context7-mcp` or `https://mcp.context7.com/mcp`.

## 3. Environment Verification

To verify that your agent environment is correctly wired, prompt your agent with:

```text
Check that you have access to:
1. Committed project skills: .agents/skills/implement-issue and .agents/skills/write-project-docs
2. Superpowers skills: test-driven-development, executing-plans, verification-before-completion
3. Context7 MCP tools: resolve-library-id and query-docs
```

Once confirmed, you are ready to begin implementing assigned GitHub issues following [docs/how-to/issue-and-pr-workflow.md](issue-and-pr-workflow.md).
