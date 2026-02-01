# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a monorepo containing multiple projects built and managed using Claude Code. Each project lives in its own subdirectory with independent tooling and configuration.

## Repository Structure

```
claude/
├── CLAUDE.md          # This file — repo-wide guidance
├── .gitignore         # Shared gitignore rules
└── <project>/         # Individual project directories
```

Each project directory is self-contained with its own build system, dependencies, and README.

## Conventions

- Each project should have its own README.md describing setup and usage.
- Shared configuration (e.g., `.gitignore`) lives at the repo root.
- Projects are independent — no cross-project imports unless explicitly designed.
