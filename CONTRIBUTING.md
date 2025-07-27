# Contributing to 1edge

Thank you for your interest in contributing to 1edge! Please follow the guidelines below to ensure a consistent and high-quality codebase. All participants are expected to be respectful and inclusive in all interactions.

## Branch & Commit Naming Conventions

All branches, commits, and issues must use specific prefixes for consistency:

| Type      | Description                                      | Branch Example         | Commit/Issue Example                      |
| --------- | ------------------------------------------------ | ---------------------- | ----------------------------------------- |
| **feat**  | New features or improvements                     | feat/add-price-check   | [feat] Add price check on collector       |
| **fix**   | Bug fixes or corrections                         | fix/update-config      | [fix] Resolve issue with config loading   |
| **refac** | Code refactoring, styling, or performance tweaks | refac/optimize-storage | [refac] Improve storage query performance |
| **ops**   | Tooling, scripting, CI/CD, and operations        | ops/update-scripts     | [ops] Update build scripts                |
| **docs**  | Documentation updates or additions               | docs/api-specs         | [docs] Add API spec for status endpoint   |

## Important Notes

- Branch names must start with the type prefix followed by `/`.
- Commit messages and issue titles must start with the type prefix in square brackets, e.g., `[feat]`.
- Capitalize the first letter of the descriptive text in branch names and commit messages.
- Each commit should be strictly scoped: include only one type of change per commit (e.g., one feat, one fix, one refac, etc.).
- Create a separate commit for each functional change to the codebase, ensuring commits remain focused and granular.

## Contribute Now!

For those interested in implementing features or fixes, please refer to:

- `./docs/to-do.md`: Contains specific features and fixes that need to be implemented
- `./docs/spec.md`: Provides general reference documentation about the system architecture and components

These documents will help you understand what needs to be done and how the system works.
