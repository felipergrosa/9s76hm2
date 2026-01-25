---
description: Implement a new feature or complex change following High Caliber Engineering standards
---

# High Caliber Implementation Workflow

This workflow enforces the engineering standards defined in the workspace.

1. **Context & Rules**
   - Read the system rules to ensure compliance.
   - `view_file c:\Users\feliperosa\.gemini\GEMINI.md`

2. **Design Phase (Measure Twice, Cut Once)**
   - Create or update the `implementation_plan.md`.
   - Define the **Objective**, **Scope**, and **Risk Level (N0/N1/N2)**.
   - **CRITICAL**: Do not write code until the plan is clear.

3. **Implementation (Small & Precise)**
   - For every file you intend to modify:
     - **ALWAYS** read the file first: `view_file [path]`
     - **Visual Check**: Count braces `{}` mentally.
     - **Apply Edit**: Use `replace_file_content` for small blocks (<50 lines).
     - **Complex Edit**: Use `multi_replace_file_content` if changing multiple distinct parts.

4. **Validation (Trust but Verify)**
   - After *every* significant edit (or batch of edits):
     - Run the build/check command: `npm run build` (in backend) or relevant script.
     - Verify no lint/syntax errors were introduced.
   - If build fails -> **STOP** -> Fix immediately -> Re-verify.

5. **Final Review**
   - Update `walkthrough.md` with:
     - What was changed.
     - Proof of verification (logs, exit codes).
   - Ensure `task.md` is fully checked.
